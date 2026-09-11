"""
Comprehensive Stock Analyzer / Screener using yfinance

For each ticker, scores four dimensions on a transparent points system and
combines them into a single 0-100 composite score and a Strong Buy / Buy /
Hold / Sell / Avoid verdict:

    1. VALUATION           ("is the price worth it?")
       Trailing P/E, PEG ratio, Price/Book, EV/EBITDA

    2. GROWTH & PROFITABILITY ("will it earn?")
       Revenue growth, earnings growth, net margin, return on equity
       (plus forward-looking analyst estimates as a proxy for "will it
       earn" — nothing can literally predict future earnings)

    3. FINANCIAL HEALTH     ("can it survive a downturn?")
       Debt/Equity, current ratio, free cash flow

    4. TECHNICAL MOMENTUM   ("is now a good entry?")
       Price vs 50/200-day SMA, 14-day RSI, distance from 52-week high

    5. ANALYST SENTIMENT (bonus, forward-looking)
       Consensus recommendation, upside to mean price target

IMPORTANT: this is a rules-based research aid, not a prediction of future
performance. Thresholds below are reasonable rules of thumb, not laws of
nature — different sectors (e.g. banks vs software) have very different
"normal" ranges for P/E, debt, and margins. Use this to prioritize which
stocks deserve a closer look, not as a final answer.
"""

import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------

TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "KO"]

HISTORY_PERIOD = "1y"
SMA_SHORT_WINDOW = 50
SMA_LONG_WINDOW = 200
RSI_WINDOW = 14

VERDICT_THRESHOLDS = [
    (75, "Strong Buy"),
    (60, "Buy"),
    (40, "Hold"),
    (25, "Sell"),
]
VERDICT_FLOOR = "Avoid"

MIN_DATA_COVERAGE_PCT = 40  # below this, flag as low-confidence rather than score confidently


# ----------------------------------------------------------------------
# Scoring helpers
# ----------------------------------------------------------------------

def score_lower_is_better(value: Optional[float], breakpoints: list, points: list) -> Optional[int]:
    """breakpoints ascending; points (len = len(breakpoints)+1) descending, best first."""
    if value is None:
        return None
    idx = 0
    for bp in breakpoints:
        if value >= bp:
            idx += 1
        else:
            break
    return points[idx]


def score_higher_is_better(value: Optional[float], breakpoints: list, points: list) -> Optional[int]:
    """breakpoints ascending; points (len = len(breakpoints)+1) ascending, best last."""
    if value is None:
        return None
    idx = 0
    for bp in breakpoints:
        if value > bp:
            idx += 1
        else:
            break
    return points[idx]


@dataclass
class MetricScore:
    category: str
    label: str
    value_display: str
    points: Optional[int]
    max_points: int
    note: str = ""


@dataclass
class AnalysisResult:
    ticker: str
    name: str = ""
    price: Optional[float] = None
    metrics: list = field(default_factory=list)
    total_score: int = 0
    max_possible_score: int = 0
    composite_score_pct: Optional[float] = None
    data_coverage_pct: float = 0.0
    verdict: str = "N/A"
    next_earnings_date: Optional[str] = None
    days_to_earnings: Optional[int] = None
    earnings_estimate: Optional[float] = None
    ex_dividend_date: Optional[str] = None
    error: Optional[str] = None


def get_upcoming_catalysts(stock: "yf.Ticker") -> dict:
    """
    Pulls the next known earnings date and ex-dividend date from
    yfinance's calendar endpoint. Wrapped defensively since this
    endpoint is frequently sparse or unavailable for smaller tickers.
    """
    catalysts = {"next_earnings": None, "earnings_estimate": None, "ex_dividend_date": None}
    try:
        cal = stock.calendar or {}

        earnings_dates = cal.get("Earnings Date")
        if earnings_dates:
            catalysts["next_earnings"] = earnings_dates[0] if isinstance(earnings_dates, (list, tuple)) else earnings_dates

        catalysts["earnings_estimate"] = cal.get("Earnings Average")
        catalysts["ex_dividend_date"] = cal.get("Ex-Dividend Date")
    except Exception:
        pass
    return catalysts


def calculate_rsi(close_prices: pd.Series, window: int = RSI_WINDOW) -> pd.Series:
    delta = close_prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.where(avg_loss != 0, 100)


def analyze_ticker(ticker: str) -> AnalysisResult:
    result = AnalysisResult(ticker=ticker)

    try:
        stock = yf.Ticker(ticker)
        history = stock.history(period=HISTORY_PERIOD, auto_adjust=True)

        if history.empty:
            result.error = "No price history returned (invalid or delisted ticker)."
            return result

        close = history["Close"].dropna()
        if close.empty:
            result.error = "No closing price data available."
            return result

        price = float(close.iloc[-1])
        result.price = round(price, 2)

        sma_50 = float(close.rolling(SMA_SHORT_WINDOW).mean().iloc[-1]) if len(close) >= SMA_SHORT_WINDOW else None
        sma_200 = float(close.rolling(SMA_LONG_WINDOW).mean().iloc[-1]) if len(close) >= SMA_LONG_WINDOW else None

        rsi = None
        if len(close) >= RSI_WINDOW + 1:
            last_rsi = calculate_rsi(close).iloc[-1]
            rsi = float(last_rsi) if pd.notna(last_rsi) else None

        high_52w = float(close.max())
        pct_off_high = (high_52w - price) / high_52w * 100 if high_52w else None

        try:
            info = stock.info or {}
        except Exception:
            info = {}

        result.name = info.get("shortName") or info.get("longName") or ticker

        catalysts = get_upcoming_catalysts(stock)
        next_earnings = catalysts["next_earnings"]
        if next_earnings is not None:
            result.next_earnings_date = str(next_earnings)
            try:
                result.days_to_earnings = (next_earnings - datetime.today().date()).days
            except TypeError:
                result.days_to_earnings = None
        result.earnings_estimate = catalysts["earnings_estimate"]
        if catalysts["ex_dividend_date"] is not None:
            result.ex_dividend_date = str(catalysts["ex_dividend_date"])

        metrics: list = []

        # ---- 1. Valuation ("is the price worth it?") ----
        pe = info.get("trailingPE")
        pts = score_lower_is_better(pe, [15, 25, 35, 50], [2, 1, 0, -1, -2])
        metrics.append(MetricScore("Valuation", "Trailing P/E", f"{pe:.1f}" if pe else "N/A", pts, 2))

        peg = info.get("pegRatio") or info.get("trailingPegRatio")
        pts = score_lower_is_better(peg, [1, 1.5, 2, 3], [2, 1, 0, -1, -2])
        metrics.append(MetricScore("Valuation", "PEG Ratio", f"{peg:.2f}" if peg else "N/A", pts, 2))

        pb = info.get("priceToBook")
        pts = score_lower_is_better(pb, [1, 3, 5, 10], [2, 1, 0, -1, -2])
        metrics.append(MetricScore("Valuation", "Price/Book", f"{pb:.2f}" if pb else "N/A", pts, 2))

        ev_ebitda = info.get("enterpriseToEbitda")
        pts = score_lower_is_better(ev_ebitda, [8, 12, 18, 25], [2, 1, 0, -1, -2])
        metrics.append(MetricScore("Valuation", "EV/EBITDA", f"{ev_ebitda:.1f}" if ev_ebitda else "N/A", pts, 2))

        # ---- 2. Growth & Profitability ("will it earn?") ----
        rev_growth = info.get("revenueGrowth")
        rev_growth_pct = rev_growth * 100 if rev_growth is not None else None
        pts = score_higher_is_better(rev_growth_pct, [0, 10, 20, 30], [-2, -1, 0, 1, 2])
        metrics.append(
            MetricScore("Growth", "Revenue Growth (YoY)", f"{rev_growth_pct:.1f}%" if rev_growth_pct is not None else "N/A", pts, 2)
        )

        earn_growth = info.get("earningsGrowth")
        earn_growth_pct = earn_growth * 100 if earn_growth is not None else None
        pts = score_higher_is_better(earn_growth_pct, [0, 10, 20, 30], [-2, -1, 0, 1, 2])
        metrics.append(
            MetricScore("Growth", "Earnings Growth (YoY)", f"{earn_growth_pct:.1f}%" if earn_growth_pct is not None else "N/A", pts, 2)
        )

        net_margin = info.get("profitMargins")
        net_margin_pct = net_margin * 100 if net_margin is not None else None
        pts = score_higher_is_better(net_margin_pct, [0, 5, 10, 20], [-2, -1, 0, 1, 2])
        metrics.append(
            MetricScore("Growth", "Net Profit Margin", f"{net_margin_pct:.1f}%" if net_margin_pct is not None else "N/A", pts, 2)
        )

        roe = info.get("returnOnEquity")
        roe_pct = roe * 100 if roe is not None else None
        pts = score_higher_is_better(roe_pct, [0, 10, 15, 20], [-2, -1, 0, 1, 2])
        metrics.append(MetricScore("Growth", "Return on Equity", f"{roe_pct:.1f}%" if roe_pct is not None else "N/A", pts, 2))

        # ---- 3. Financial Health ("can it survive a downturn?") ----
        debt_to_equity = info.get("debtToEquity")  # yfinance reports this as a percent (e.g. 150 = 1.5x)
        pts = score_lower_is_better(debt_to_equity, [50, 100, 150, 250], [2, 1, 0, -1, -2])
        metrics.append(
            MetricScore("Financial Health", "Debt/Equity", f"{debt_to_equity:.0f}%" if debt_to_equity is not None else "N/A", pts, 2)
        )

        current_ratio = info.get("currentRatio")
        pts = score_higher_is_better(current_ratio, [1, 1.5, 2, 3], [-2, -1, 0, 1, 2])
        metrics.append(
            MetricScore("Financial Health", "Current Ratio", f"{current_ratio:.2f}" if current_ratio is not None else "N/A", pts, 2)
        )

        free_cash_flow = info.get("freeCashflow")
        if free_cash_flow is None:
            fcf_pts, fcf_display = None, "N/A"
        else:
            fcf_pts = 1 if free_cash_flow > 0 else -1
            fcf_display = f"${free_cash_flow / 1e9:.2f}B" if abs(free_cash_flow) >= 1e9 else f"${free_cash_flow / 1e6:.1f}M"
        metrics.append(MetricScore("Financial Health", "Free Cash Flow", fcf_display, fcf_pts, 1))

        # ---- 4. Technical Momentum ("is now a good entry?") ----
        if sma_50 is not None:
            pts = 1 if price > sma_50 else -1
            metrics.append(MetricScore("Momentum", "Price vs 50-day SMA", f"${price:.2f} vs ${sma_50:.2f}", pts, 1))
        else:
            metrics.append(MetricScore("Momentum", "Price vs 50-day SMA", "N/A", None, 1))

        if sma_200 is not None:
            pts = 2 if price > sma_200 else -2
            metrics.append(MetricScore("Momentum", "Price vs 200-day SMA", f"${price:.2f} vs ${sma_200:.2f}", pts, 2))
        else:
            metrics.append(MetricScore("Momentum", "Price vs 200-day SMA", "N/A", None, 2))

        if rsi is not None:
            if rsi > 70:
                rsi_pts, rsi_note = -2, "overbought"
            elif rsi > 55:
                rsi_pts, rsi_note = 1, "strong"
            elif rsi >= 45:
                rsi_pts, rsi_note = 0, "neutral"
            elif rsi >= 30:
                rsi_pts, rsi_note = -1, "weak"
            else:
                rsi_pts, rsi_note = -2, "oversold"
            metrics.append(MetricScore("Momentum", "RSI (14-day)", f"{rsi:.1f} ({rsi_note})", rsi_pts, 2))
        else:
            metrics.append(MetricScore("Momentum", "RSI (14-day)", "N/A", None, 2))

        pts = score_lower_is_better(pct_off_high, [5, 20, 40], [1, 0, -1, -2])
        metrics.append(
            MetricScore("Momentum", "Distance from 52-wk high", f"{pct_off_high:.1f}%" if pct_off_high is not None else "N/A", pts, 1)
        )

        # ---- 5. Analyst Sentiment (bonus, forward-looking) ----
        rec_key = (info.get("recommendationKey") or "").lower()
        rec_map = {"strong_buy": 1, "buy": 1, "hold": 0, "sell": -1, "strong_sell": -1, "underperform": -1}
        rec_pts = rec_map.get(rec_key)
        metrics.append(MetricScore("Analyst Sentiment", "Consensus Rating", rec_key.replace("_", " ").title() or "N/A", rec_pts, 1))

        target_price = info.get("targetMeanPrice")
        upside_pct = (target_price / price - 1) * 100 if target_price and price else None
        pts = score_higher_is_better(upside_pct, [-10, 15], [-1, 0, 1])
        metrics.append(
            MetricScore("Analyst Sentiment", "Upside to Price Target", f"{upside_pct:+.1f}%" if upside_pct is not None else "N/A", pts, 1)
        )

        result.metrics = metrics

        total_score = sum(m.points for m in metrics if m.points is not None)
        max_possible = sum(m.max_points for m in metrics if m.points is not None)
        total_possible_if_complete = sum(m.max_points for m in metrics)

        result.total_score = total_score
        result.max_possible_score = max_possible
        result.data_coverage_pct = round(max_possible / total_possible_if_complete * 100, 1) if total_possible_if_complete else 0.0

        if max_possible > 0:
            # Normalize (-max..+max) onto a 0-100 scale, 50 = neutral
            result.composite_score_pct = round((total_score / max_possible + 1) / 2 * 100, 1)
            if result.data_coverage_pct < MIN_DATA_COVERAGE_PCT:
                result.verdict = "Low Confidence (insufficient data)"
            else:
                result.verdict = VERDICT_FLOOR
                for threshold, label in VERDICT_THRESHOLDS:
                    if result.composite_score_pct >= threshold:
                        result.verdict = label
                        break
        else:
            result.verdict = "N/A (no data)"

    except Exception as exc:
        result.error = f"Unexpected error: {exc}"

    return result


def print_detailed_report(result: AnalysisResult) -> None:
    print(f"\n{'=' * 70}")
    print(f"{result.ticker} — {result.name}")
    print(f"{'=' * 70}")

    if result.error:
        print(f"  Error: {result.error}")
        return

    print(f"Current Price: ${result.price:,.2f}\n")

    rows = [
        {"Category": m.category, "Metric": m.label, "Value": m.value_display, "Score": f"{m.points:+d}/{m.max_points}" if m.points is not None else "N/A"}
        for m in result.metrics
    ]
    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    print(f"\nData coverage: {result.data_coverage_pct:.0f}% of metrics available")
    if result.composite_score_pct is not None:
        print(f"Composite Score: {result.composite_score_pct:.1f} / 100")
    print(f"Verdict: {result.verdict}")

    print("\n--- Upcoming Catalysts ---")
    if result.next_earnings_date:
        countdown = f" ({result.days_to_earnings} days away)" if result.days_to_earnings is not None else ""
        print(f"  Next Earnings: {result.next_earnings_date}{countdown}")
        if result.earnings_estimate is not None:
            print(f"  Consensus EPS Estimate: {result.earnings_estimate:.2f}")
    else:
        print("  Next Earnings: N/A (not published yet)")
    if result.ex_dividend_date:
        print(f"  Ex-Dividend Date: {result.ex_dividend_date}")


def print_summary_table(results: list) -> None:
    print(f"\n{'=' * 70}")
    print("=== Screening Summary (ranked by composite score) ===")
    print(f"{'=' * 70}")

    rows = []
    for r in results:
        next_earnings = (
            f"{r.next_earnings_date} ({r.days_to_earnings}d)"
            if r.next_earnings_date and r.days_to_earnings is not None
            else (r.next_earnings_date or "N/A")
        )
        rows.append(
            {
                "Ticker": r.ticker,
                "Price": f"${r.price:,.2f}" if r.price is not None else "N/A",
                "Score": r.composite_score_pct if r.composite_score_pct is not None else float("-inf"),
                "Coverage": f"{r.data_coverage_pct:.0f}%",
                "Verdict": r.verdict,
                "Next Earnings": next_earnings,
            }
        )

    df = pd.DataFrame(rows).sort_values("Score", ascending=False)
    df["Score"] = df["Score"].apply(lambda v: f"{v:.1f}" if v != float("-inf") else "N/A")
    print(df.to_string(index=False))


def main() -> None:
    results = [analyze_ticker(t) for t in TICKERS]

    for result in results:
        print_detailed_report(result)

    print_summary_table(results)

    print(
        "\nNote: this is a rules-based composite score for prioritizing research, "
        "not a guarantee of future performance. Always sanity-check against the "
        "underlying financials and news for the company before acting."
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        sys.exit(1)
