"""
SMA Crossover Backtest using yfinance

Downloads daily history for a stock and walks through it one trading day
at a time, tracking a 50-day/200-day SMA "Golden Cross / Death Cross"
strategy:

    - Golden Cross (SMA_50 crosses above SMA_200): go 'Invested' (buy)
    - Death Cross  (SMA_50 crosses below SMA_200): go 'In Cash' (sell)

This script deliberately guards against the three most common backtesting
mistakes:

    1. LOOK-AHEAD BIAS: All indicators are computed with pandas' rolling()
       (a strictly trailing window, never `center=True`), and the signal
       used to trade "today" only ever looks at SMA values through today's
       close. `verify_no_lookahead()` proves this by independently
       recomputing the SMAs at sample dates using ONLY data available up
       to that date and asserting they match the vectorized calculation.

    2. TRANSACTION COSTS: Every BUY/SELL pays SLIPPAGE_PCT (default 0.10%)
       against the market close price, and the buy-and-hold benchmark
       pays the same slippage on its single entry trade so the comparison
       stays apples-to-apples.

    3. OVERFITTING / CURVE FITTING: `run_validation_suite()` reruns the
       exact same, unmodified strategy across multiple tickers and
       multiple non-overlapping historical periods. A strategy that only
       looks good on one stock over one date range is a red flag for
       curve fitting, not a validated edge.

Other assumptions (kept simple on purpose):
    - Trades execute at that day's closing price (plus slippage).
    - 100% of available cash is deployed on a buy signal; the full
      position is liquidated on a sell signal (no partial sizing).
    - Fractional shares are allowed.
    - No commissions, taxes, or dividends modeled beyond slippage.
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

TICKER = "AAPL"
BACKTEST_YEARS = 5
INITIAL_CAPITAL = 10_000.00

SMA_SHORT_WINDOW = 50
SMA_LONG_WINDOW = 200

# Sin #2 (Transaction Costs): applied to every BUY and every SELL,
# and to the buy-and-hold benchmark's single entry trade.
SLIPPAGE_PCT = 0.001  # 0.10%

# Sin #3 (Overfitting): re-run the same strategy out-of-sample, across
# different stocks (different sectors) and different historical windows,
# instead of trusting a single stock/period result.
VALIDATION_TICKERS = ["MSFT", "JPM", "XOM", "SPY"]
VALIDATION_PERIODS = [
    ("2010-01-01", "2015-01-01"),
    ("2018-01-01", "2023-01-01"),
]


@dataclass
class Trade:
    date: pd.Timestamp
    action: str  # "BUY" or "SELL"
    market_price: float  # the day's close, before slippage
    price: float  # actual executed price, after slippage
    shares: float
    slippage_cost: float
    cash_after: float
    portfolio_value_after: float


@dataclass
class BacktestResult:
    ticker: str
    trades: list = field(default_factory=list)
    equity_curve: pd.Series = field(default_factory=pd.Series)
    final_state: str = "In Cash"
    final_portfolio_value: float = 0.0
    buy_and_hold_value: float = 0.0
    max_drawdown_pct: float = 0.0
    completed_trades: int = 0
    winning_trades: int = 0
    win_rate_pct: Optional[float] = None
    total_slippage_cost: float = 0.0
    start_date: Optional[pd.Timestamp] = None
    end_date: Optional[pd.Timestamp] = None
    error: Optional[str] = None


def fetch_price_history(
    ticker: str,
    years: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """
    Download daily OHLCV history. Either pass `years` (trailing window
    from today) or an explicit `start_date`/`end_date` (e.g. for
    out-of-sample validation over a fixed historical window).
    Raises ValueError with a clear message if the ticker is invalid
    or there isn't enough data to run the strategy.
    """
    if start_date and end_date:
        start, end = start_date, end_date
    else:
        end_dt = datetime.today()
        start_dt = end_dt - timedelta(days=365 * (years or BACKTEST_YEARS) + 30)  # small buffer
        start, end = start_dt, end_dt

    try:
        data = yf.Ticker(ticker).history(start=start, end=end, auto_adjust=True)
    except Exception as exc:
        raise ValueError(f"Failed to download data for '{ticker}': {exc}") from exc

    if data.empty:
        raise ValueError(f"No price history returned for '{ticker}' (invalid or delisted ticker).")

    data = data.dropna(subset=["Close"])

    if len(data) < SMA_LONG_WINDOW:
        raise ValueError(
            f"Only {len(data)} trading days of data available for '{ticker}'; "
            f"need at least {SMA_LONG_WINDOW} to compute the 200-day SMA."
        )

    return data


def compute_moving_averages(data: pd.DataFrame) -> pd.DataFrame:
    """
    Trailing-only rolling windows: SMA_50 on day t uses Close[t-49..t],
    SMA_200 uses Close[t-199..t]. Never `center=True`, never a negative
    shift — both of those would leak future prices into today's signal.
    """
    df = data.copy()
    df["SMA_50"] = df["Close"].rolling(window=SMA_SHORT_WINDOW, center=False).mean()
    df["SMA_200"] = df["Close"].rolling(window=SMA_LONG_WINDOW, center=False).mean()
    return df


def verify_no_lookahead(df: pd.DataFrame, sample_size: int = 5) -> None:
    """
    Sin #1 (Look-Ahead Bias) guard: independently recompute SMA_50 and
    SMA_200 at several sample dates using ONLY the price history up to
    and including that date, then assert it matches the vectorized
    rolling calculation used by the backtest. If a bug ever let future
    data leak into the indicators (e.g. a center=True window or an
    off-by-one shift), this check will fail loudly instead of quietly
    producing an unrealistically profitable backtest.
    """
    tradable = df.dropna(subset=["SMA_50", "SMA_200"])
    if tradable.empty:
        return

    step = max(len(tradable) // sample_size, 1)
    sample_dates = tradable.index[::step][:sample_size]

    for date in sample_dates:
        history_up_to_date = df.loc[:date, "Close"]
        recomputed_sma_50 = history_up_to_date.rolling(SMA_SHORT_WINDOW).mean().iloc[-1]
        recomputed_sma_200 = history_up_to_date.rolling(SMA_LONG_WINDOW).mean().iloc[-1]

        vectorized_sma_50 = df.loc[date, "SMA_50"]
        vectorized_sma_200 = df.loc[date, "SMA_200"]

        assert abs(recomputed_sma_50 - vectorized_sma_50) < 1e-6, (
            f"Look-ahead bias detected in SMA_50 at {date.date()}: "
            f"trailing-only recompute={recomputed_sma_50:.4f} vs "
            f"vectorized={vectorized_sma_50:.4f}"
        )
        assert abs(recomputed_sma_200 - vectorized_sma_200) < 1e-6, (
            f"Look-ahead bias detected in SMA_200 at {date.date()}: "
            f"trailing-only recompute={recomputed_sma_200:.4f} vs "
            f"vectorized={vectorized_sma_200:.4f}"
        )

    print(f"Look-ahead bias check passed ({len(sample_dates)} sample dates verified).")


def compute_max_drawdown(equity_curve: pd.Series) -> float:
    """
    Max drawdown = the largest peak-to-trough decline in portfolio value
    over the full equity curve, expressed as a positive percentage.
    """
    if equity_curve.empty:
        return 0.0
    running_peak = equity_curve.cummax()
    drawdown = (equity_curve - running_peak) / running_peak
    return round(abs(float(drawdown.min())) * 100, 2)


def compute_win_rate(trades: list) -> tuple:
    """
    Pairs each BUY with the SELL that closes it into a completed
    round-trip trade, and counts one as a "win" if the (slippage-adjusted)
    sell price is higher than the buy price. A trailing BUY with no
    matching SELL yet (still an open position) is excluded.
    """
    completed = 0
    wins = 0
    open_buy_price: Optional[float] = None

    for trade in trades:
        if trade.action == "BUY":
            open_buy_price = trade.price
        elif trade.action == "SELL" and open_buy_price is not None:
            completed += 1
            if trade.price > open_buy_price:
                wins += 1
            open_buy_price = None

    win_rate = round(wins / completed * 100, 2) if completed > 0 else None
    return completed, wins, win_rate


def run_backtest(
    ticker: str,
    df: pd.DataFrame,
    initial_capital: float,
    slippage_pct: float = SLIPPAGE_PCT,
) -> BacktestResult:
    """
    Iterate through the price history day by day. Once both SMAs are
    available, detect Golden Cross / Death Cross events using only
    that day's (and earlier) data and flip the strategy between
    'In Cash' and 'Invested' accordingly. Every trade pays slippage.
    """
    result = BacktestResult(ticker=ticker)

    # Only trading days with both SMAs computed can generate signals
    tradable = df.dropna(subset=["SMA_50", "SMA_200"])

    if tradable.empty:
        result.error = "Not enough history to compute both SMAs."
        return result

    result.start_date = tradable.index[0]
    result.end_date = tradable.index[-1]

    state = "In Cash"
    cash = initial_capital
    shares = 0.0
    total_slippage_cost = 0.0

    prev_sma_50: Optional[float] = None
    prev_sma_200: Optional[float] = None

    equity_dates = []
    equity_values = []

    for date, row in tradable.iterrows():
        close = float(row["Close"])
        sma_50 = row["SMA_50"]
        sma_200 = row["SMA_200"]

        if prev_sma_50 is not None and prev_sma_200 is not None:
            golden_cross = prev_sma_50 <= prev_sma_200 and sma_50 > sma_200
            death_cross = prev_sma_50 >= prev_sma_200 and sma_50 < sma_200

            if golden_cross and state == "In Cash":
                exec_price = close * (1 + slippage_pct)  # you pay slightly more, buying
                shares = cash / exec_price
                slippage_cost = cash - shares * close  # extra $ lost vs a frictionless fill
                total_slippage_cost += slippage_cost
                cash = 0.0
                state = "Invested"
                result.trades.append(
                    Trade(
                        date=date,
                        action="BUY",
                        market_price=round(close, 2),
                        price=round(exec_price, 2),
                        shares=round(shares, 4),
                        slippage_cost=round(slippage_cost, 2),
                        cash_after=round(cash, 2),
                        portfolio_value_after=round(shares * close, 2),
                    )
                )

            elif death_cross and state == "Invested":
                exec_price = close * (1 - slippage_pct)  # you receive slightly less, selling
                proceeds = shares * exec_price
                slippage_cost = shares * close - proceeds  # extra $ lost vs a frictionless fill
                total_slippage_cost += slippage_cost
                cash = proceeds
                sold_shares = shares
                shares = 0.0
                state = "In Cash"
                result.trades.append(
                    Trade(
                        date=date,
                        action="SELL",
                        market_price=round(close, 2),
                        price=round(exec_price, 2),
                        shares=round(sold_shares, 4),
                        slippage_cost=round(slippage_cost, 2),
                        cash_after=round(cash, 2),
                        portfolio_value_after=round(cash, 2),
                    )
                )

        prev_sma_50, prev_sma_200 = sma_50, sma_200

        # Mark portfolio value to market every day, regardless of whether
        # a trade happened, so the equity curve reflects daily price moves
        # while invested (needed for an accurate max drawdown).
        equity_dates.append(date)
        equity_values.append(cash + shares * close)

    final_close = float(tradable["Close"].iloc[-1])
    result.final_state = state
    result.final_portfolio_value = round(cash + shares * final_close, 2)
    result.total_slippage_cost = round(total_slippage_cost, 2)

    # Buy-and-hold benchmark pays the same entry slippage, so it isn't
    # unfairly compared against a frictionless "free" alternative.
    first_tradable_close = float(tradable["Close"].iloc[0])
    bnh_entry_price = first_tradable_close * (1 + slippage_pct)
    bnh_shares = initial_capital / bnh_entry_price
    result.buy_and_hold_value = round(bnh_shares * final_close, 2)

    result.equity_curve = pd.Series(equity_values, index=pd.Index(equity_dates, name="Date"))
    result.max_drawdown_pct = compute_max_drawdown(result.equity_curve)
    result.completed_trades, result.winning_trades, result.win_rate_pct = compute_win_rate(result.trades)

    return result


def print_report(result: BacktestResult, initial_capital: float) -> None:
    if result.error:
        print(f"\nBacktest failed for {result.ticker}: {result.error}")
        return

    print(f"\n=== SMA {SMA_SHORT_WINDOW}/{SMA_LONG_WINDOW} Crossover Backtest: {result.ticker} ===")
    print(f"Period: {result.start_date.date()} to {result.end_date.date()}")
    print(f"Initial capital: ${initial_capital:,.2f}")
    print(f"Slippage per transaction: {SLIPPAGE_PCT * 100:.2f}%\n")

    if not result.trades:
        print("No Golden Cross / Death Cross signals occurred during this period.")
    else:
        print("=== Trade Log ===")
        trade_rows = [
            {
                "Date": t.date.date(),
                "Action": t.action,
                "Market Px": f"${t.market_price:,.2f}",
                "Exec Px": f"${t.price:,.2f}",
                "Shares": f"{t.shares:,.4f}",
                "Slippage $": f"${t.slippage_cost:,.2f}",
                "Cash After": f"${t.cash_after:,.2f}",
                "Value After": f"${t.portfolio_value_after:,.2f}",
            }
            for t in result.trades
        ]
        trade_df = pd.DataFrame(trade_rows)
        print(trade_df.to_string(index=False))

    strategy_return_pct = (result.final_portfolio_value / initial_capital - 1) * 100
    bnh_return_pct = (result.buy_and_hold_value / initial_capital - 1) * 100

    print("\n=== Final Summary ===")
    print(f"{'Ending state:':<28}{result.final_state}")
    print(f"{'Strategy final value:':<28}${result.final_portfolio_value:,.2f}")
    print(f"{'Buy & hold final value:':<28}${result.buy_and_hold_value:,.2f}")
    print(f"{'Number of trades:':<28}{len(result.trades)}")

    # ---- Final Performance Report ----
    win_rate_display = (
        f"{result.win_rate_pct:.2f}%  ({result.winning_trades}/{result.completed_trades} completed trades)"
        if result.win_rate_pct is not None
        else "N/A (no completed round-trip trades)"
    )

    print("\n=== Final Performance Report ===")
    print(f"{'1. Total Strategy Return:':<32}{strategy_return_pct:+.2f}%")
    print(f"{'2. Total Buy-and-Hold Return:':<32}{bnh_return_pct:+.2f}%")
    print(f"{'3. Maximum Drawdown:':<32}-{result.max_drawdown_pct:.2f}%")
    print(f"{'4. Win Rate:':<32}{win_rate_display}")
    print(
        f"{'5. Total Slippage Cost Paid:':<32}"
        f"${result.total_slippage_cost:,.2f}  "
        f"({result.total_slippage_cost / initial_capital * 100:.2f}% of initial capital)"
    )


def run_validation_suite(
    tickers: list,
    periods: list,
    initial_capital: float,
    slippage_pct: float = SLIPPAGE_PCT,
) -> pd.DataFrame:
    """
    Sin #3 (Overfitting) guard: rerun the exact same strategy, unmodified,
    across multiple tickers and multiple non-overlapping historical
    periods. This is what separates "I found an edge" from "I memorized
    one stock's chart."
    """
    rows = []

    for ticker in tickers:
        for start, end in periods:
            period_label = f"{start} to {end}"
            try:
                raw = fetch_price_history(ticker, start_date=start, end_date=end)
                df = compute_moving_averages(raw)
                result = run_backtest(ticker, df, initial_capital, slippage_pct)
            except ValueError as exc:
                rows.append(
                    {
                        "Ticker": ticker,
                        "Period": period_label,
                        "Strategy %": None,
                        "BuyHold %": None,
                        "Beat B&H": "N/A",
                        "MaxDD %": None,
                        "WinRate %": None,
                        "Trades": None,
                        "Notes": str(exc),
                    }
                )
                continue

            if result.error:
                rows.append(
                    {
                        "Ticker": ticker,
                        "Period": period_label,
                        "Strategy %": None,
                        "BuyHold %": None,
                        "Beat B&H": "N/A",
                        "MaxDD %": None,
                        "WinRate %": None,
                        "Trades": None,
                        "Notes": result.error,
                    }
                )
                continue

            strategy_return = round((result.final_portfolio_value / initial_capital - 1) * 100, 2)
            bnh_return = round((result.buy_and_hold_value / initial_capital - 1) * 100, 2)

            rows.append(
                {
                    "Ticker": ticker,
                    "Period": period_label,
                    "Strategy %": strategy_return,
                    "BuyHold %": bnh_return,
                    "Beat B&H": "Yes" if strategy_return > bnh_return else "No",
                    "MaxDD %": result.max_drawdown_pct,
                    "WinRate %": result.win_rate_pct,
                    "Trades": len(result.trades),
                    "Notes": "OK",
                }
            )

    return pd.DataFrame(rows)


def print_validation_report(summary: pd.DataFrame) -> None:
    print("\n" + "=" * 78)
    print("=== Out-of-Sample Validation: Multiple Stocks x Multiple Periods ===")
    print("=" * 78)
    print(summary.to_string(index=False))

    valid = summary[summary["Notes"] == "OK"]
    if valid.empty:
        print("\nNo valid validation runs completed.")
        return

    beat_count = (valid["Beat B&H"] == "Yes").sum()
    total_count = len(valid)
    avg_strategy_return = valid["Strategy %"].mean()
    avg_bnh_return = valid["BuyHold %"].mean()

    print("\n=== Validation Summary ===")
    print(f"{'Runs where strategy beat buy & hold:':<40}{beat_count}/{total_count}")
    print(f"{'Average strategy return:':<40}{avg_strategy_return:+.2f}%")
    print(f"{'Average buy & hold return:':<40}{avg_bnh_return:+.2f}%")

    if beat_count / total_count < 0.5:
        print(
            "\nWarning: the strategy beat buy-and-hold in fewer than half of the "
            "out-of-sample tests. Treat the single-ticker headline result with "
            "caution — it may be an artifact of that specific stock/period rather "
            "than a robust edge."
        )


def main() -> None:
    try:
        raw_data = fetch_price_history(TICKER, years=BACKTEST_YEARS)
    except ValueError as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    df = compute_moving_averages(raw_data)
    verify_no_lookahead(df)

    result = run_backtest(TICKER, df, INITIAL_CAPITAL)
    print_report(result, INITIAL_CAPITAL)

    validation_summary = run_validation_suite(VALIDATION_TICKERS, VALIDATION_PERIODS, INITIAL_CAPITAL)
    print_validation_report(validation_summary)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        sys.exit(1)
