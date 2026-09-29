'use client';

import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { strategySlug } from '@/lib/optionsStrategyRules';

const RISK_TYPE_STYLES = {
  defined: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  undefined: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const RISK_TYPE_LABELS = {
  defined: 'Defined risk',
  undefined: 'Undefined risk',
};

const DIRECTION_STYLES = {
  Bullish: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Bearish: 'bg-red-500/10 text-red-300 border-red-500/20',
  Neutral: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  'Neutral to Mildly Bullish': 'bg-emerald-500/10 text-emerald-300/90 border-emerald-500/20',
  'Neutral to Mildly Bearish': 'bg-red-500/10 text-red-300/90 border-red-500/20',
};

const CATEGORY_ORDER = ['Long Options', 'Covered & Cash-Secured', 'Credit Spreads', 'Debit Spreads', 'Volatility Plays', 'Naked'];

const CATEGORY_BLURBS = {
  'Long Options': 'Buy a single call or put outright — the simplest directional bet, risk capped at the premium paid.',
  'Covered & Cash-Secured': 'Sell premium backed by shares or cash you already hold or are willing to hold — the collateral is what keeps the risk defined.',
  'Credit Spreads': 'Sell a strike and buy a further one for protection — collect a net credit, risk capped by the spread width. The long leg is effectively a hedge against the short leg, also known as hedging the position.',
  'Debit Spreads': 'Buy a strike and sell a further one to offset cost — pay a net debit, gain capped by the spread width. The short leg here also acts as a partial hedge, offsetting some of the cost of the long leg.',
  'Naked': 'Sell premium uncovered, without cash or shares set aside — theoretically unlimited or near-unlimited loss. Generally not recommended; the collateralized versions of these trades (Cash-Secured Put, Covered Call) offer a similar payoff with defined risk.',
  'Volatility Plays': 'Positioned on the size of a move rather than its direction.',
};

const STRATEGY_GUIDE = [
  {
    strategy: 'Long Call',
    category: 'Long Options',
    direction: 'Bullish',
    riskType: 'defined',
    mechanics: 'Buy 1 call option outright — the simplest bullish bet.',
    maxGain: 'Theoretically unlimited — the stock can keep rising.',
    maxLoss: 'The premium paid.',
    bestUsed: 'Strong bullish conviction with implied volatility running low, wanting uncapped upside rather than a spread.',
    watchOutFor: 'Time decay works against you every day you hold it — if the stock just drifts sideways or up slowly, the premium can bleed away before the move you expected shows up.',
    howToManage: 'An at-the-money strike is roughly 0.50 delta — the classic middle ground between cost and probability of profit. Common heuristic: take profit around 30–50% of the premium paid, and cut the loss around 30% rather than riding it toward zero. Time decay accelerates sharply inside the last ~21 days to expiration, so don’t let a stalled position drift unmanaged into that window.',
    bestFitFor: ['Low capital', 'Directional conviction', 'Moderate–aggressive'],
  },
  {
    strategy: 'Long Put',
    category: 'Long Options',
    direction: 'Bearish',
    riskType: 'defined',
    mechanics: 'Buy 1 put option outright — the simplest bearish bet.',
    maxGain: 'Substantial — the stock can fall all the way to zero.',
    maxLoss: 'The premium paid.',
    bestUsed: 'Strong bearish conviction with implied volatility running low, wanting full downside exposure rather than a spread.',
    watchOutFor: 'Same time-decay problem as the long call — if the drop takes too long to arrive (or doesn’t arrive at all), theta erodes the premium even if you’re eventually right on direction.',
    howToManage: 'Same 0.50-delta logic as the long call at an at-the-money strike. Common heuristic: take profit around 30–50% of the premium paid, cut the loss around 30% rather than letting it decay toward zero, and treat ~21 days to expiration as a checkpoint to close or roll rather than hold through the final stretch.',
    bestFitFor: ['Low capital', 'Directional conviction', 'Moderate–aggressive'],
  },
  {
    strategy: 'Covered Call',
    category: 'Covered & Cash-Secured',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'defined',
    note: "Requires already owning (or being ready to buy) 100 shares of the stock.",
    mechanics: 'Already own (or buy) 100 shares of the stock, then sell 1 call option against them at a strike above the current price, collecting premium.',
    maxGain: 'Strike price minus your cost basis, plus the premium collected — capped once the stock is called away.',
    maxLoss: 'Your cost basis in the shares minus the premium collected — essentially the downside of owning the stock outright, cushioned slightly by the premium.',
    bestUsed: 'Already hold (or are willing to hold) the shares, a neutral-to-mildly-bullish view, and comfortable having the stock called away at the strike if it rallies past it.',
    watchOutFor: 'Caps your upside at the strike — if the stock rallies hard, you miss all the gains above it, while you still carry the full downside risk of owning the shares beyond the small premium cushion.',
    howToManage: 'Common heuristic: buy the call back once you’ve captured around 50% of the premium sold, rather than holding for the last dollar. There’s no fixed loss percentage to cut at here — the real signal is whether you’re still comfortable holding the shares if the call expires worthless, which is a stock-comfort question, not a P&L one.',
    bestFitFor: ['Larger accounts', 'Income seekers', 'Conservative–moderate'],
  },
  {
    strategy: 'Cash-Secured Put',
    category: 'Covered & Cash-Secured',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'defined',
    mechanics: "Sell 1 put option at a strike you'd be comfortable owning the stock at, while setting aside the full cash (strike × 100) to buy the shares if assigned.",
    maxGain: 'The premium collected.',
    maxLoss: 'Strike price × 100 minus the premium collected — the worst case is the stock going to zero.',
    bestUsed: "Bullish view, implied volatility running elevated (richer premium), and genuine willingness to own the stock at that strike if assigned.",
    watchOutFor: 'Ties up significant cash for the life of the trade, and caps your gain at the premium collected — if the stock rips higher, you don’t participate in any of that upside.',
    howToManage: 'Common heuristic: close for a profit once you’ve captured around 50% of the premium collected — the remaining decay usually isn’t worth the tail risk of holding to expiration. There’s no fixed loss percentage to cut at; the real question is whether you’re still comfortable owning the stock at this strike if assigned. If not, that’s the signal to close or roll, not a P&L number.',
    bestFitFor: ['Larger accounts', 'Income seekers', 'Conservative–moderate'],
  },
  {
    strategy: 'Bull Put Credit Spread',
    category: 'Credit Spreads',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'defined',
    mechanics: 'Sell a put at one strike, and buy a further out-of-the-money put at a lower strike for protection. Collect the net credit (the difference in premiums).',
    maxGain: 'The net credit received.',
    maxLoss: 'The difference between the two strikes, minus the credit received.',
    bestUsed: 'Same bullish, elevated-vol case as the cash-secured put, but needs far less capital and has a hard cap on the downside.',
    watchOutFor: 'The max loss is typically several times the credit received, so a sharp reversal hurts more than the small capped gain would suggest — the payoff is asymmetric even though the risk is defined.',
    howToManage: 'Common heuristic: close for a profit once you’ve captured around 50% of the credit received. On the loss side, treat the spread’s value roughly doubling (i.e. it costing about 100% of the credit received to close) as the point to cut, rather than letting it run toward the max loss. Also worth closing or rolling by ~21 days to expiration — gamma risk accelerates sharply in the final stretch, working against a defined-risk position that’s already near the money.',
    bestFitFor: ['Low–moderate capital', 'Income seekers', 'Conservative–moderate'],
  },
  {
    strategy: 'Bear Call Credit Spread',
    category: 'Credit Spreads',
    direction: 'Neutral to Mildly Bearish',
    riskType: 'defined',
    mechanics: 'Sell a call at one strike, and buy a further out-of-the-money call at a higher strike for protection. Collect the net credit.',
    maxGain: 'The net credit received.',
    maxLoss: 'The difference between the two strikes, minus the credit received.',
    bestUsed: 'Bearish view with implied volatility running elevated — capped risk instead of a naked call.',
    watchOutFor: 'Same asymmetry as the bull put spread — a small capped credit against a max loss that’s a multiple of it if the stock rallies hard through your short strike.',
    howToManage: 'Same rules as the bull put spread: close for a profit around 50% of the credit received, cut the loss once the spread’s cost to close roughly doubles the credit received, and treat ~21 days to expiration as a checkpoint to close or roll.',
    bestFitFor: ['Low–moderate capital', 'Income seekers', 'Conservative–moderate'],
  },
  {
    strategy: 'Bull Call Debit Spread',
    category: 'Debit Spreads',
    direction: 'Bullish',
    riskType: 'defined',
    mechanics: 'Buy a call at one strike, and sell a further out-of-the-money call at a higher strike to offset some of the cost.',
    maxGain: 'The difference between the two strikes, minus the debit paid.',
    maxLoss: 'The debit (premium) paid.',
    bestUsed: 'Bullish view when implied volatility is running low, making the long call cheaper — the short call caps upside but recoups some cost.',
    watchOutFor: 'Gains are capped even if the stock blows past your short strike — you give up all the extra upside a long call alone would have captured.',
    howToManage: 'Common heuristic: take profit around 30–50% of the max gain, and cut the loss around 30% of the debit paid rather than letting it decay to zero. Being defined-risk on both sides, it’s less urgent to close by 21 days than a naked or credit position, but decay still accelerates into that window.',
    bestFitFor: ['Low–moderate capital', 'Directional conviction', 'Moderate'],
  },
  {
    strategy: 'Bear Put Debit Spread',
    category: 'Debit Spreads',
    direction: 'Bearish',
    riskType: 'defined',
    mechanics: 'Buy a put at one strike, and sell a further out-of-the-money put at a lower strike to offset some of the cost.',
    maxGain: 'The difference between the two strikes, minus the debit paid.',
    maxLoss: 'The debit (premium) paid.',
    bestUsed: 'Bearish view when implied volatility is running low, making the long put cheaper.',
    watchOutFor: 'Same capped-gain trade-off — if the stock crashes well past your short strike, you don’t get the extra downside a long put alone would have captured.',
    howToManage: 'Same rules as the bull call spread: take profit around 30–50% of the max gain, and cut the loss around 30% of the debit paid.',
    bestFitFor: ['Low–moderate capital', 'Directional conviction', 'Moderate'],
  },
  {
    strategy: 'Naked Call',
    category: 'Naked',
    direction: 'Neutral to Mildly Bearish',
    riskType: 'undefined',
    mechanics: 'Sell a call without owning the underlying shares (uncovered) — the classic high-risk premium-selling trade.',
    maxGain: 'The premium collected.',
    maxLoss: 'Theoretically unlimited — the stock can keep rising with no ceiling.',
    bestUsed: 'Bearish view with implied volatility running elevated. Requires margin approval and very careful position sizing.',
    watchOutFor: 'A single bad earnings surprise or short squeeze can wipe out far more than the premium collected — of every strategy on this page, this one has the least protection against being wrong.',
    howToManage: 'Common heuristic: close around 50% of premium captured — don’t hold undefined risk for the last dollar of decay. With uncapped loss potential, treat 100% of the credit received (i.e. the position doubling against you) as a hard stop, not a soft guideline, and close or roll by ~21 days to expiration rather than let gamma risk build into the final stretch.',
    bestFitFor: ['Margin accounts', 'Income seekers', 'Aggressive only'],
  },
  {
    strategy: 'Naked Put',
    category: 'Naked',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'undefined',
    mechanics: 'Sell a put without setting aside the full cash to buy the shares — relying on broker margin instead of a cash-secured position.',
    maxGain: 'The premium collected.',
    maxLoss: 'Strike price × 100 minus the premium collected.',
    bestUsed: 'Same bullish, elevated-vol case as the cash-secured put, when capital efficiency matters more than full cash backing. Requires margin approval and careful position sizing.',
    watchOutFor: 'The max loss itself is the same size as a cash-secured put’s, but the funding underneath it is thinner — a sharp drop can trigger a margin call or forced liquidation before you’ve even decided whether to hold through assignment.',
    howToManage: 'Same as the cash-secured put: close around 50% of premium captured, and the loss signal is stock comfort at this strike, not a fixed P&L number. Because the position isn’t fully collateralized, err toward closing earlier rather than later — thin margin gives you less room to wait out a drawdown.',
    bestFitFor: ['Margin accounts', 'Income seekers', 'Aggressive only'],
  },
  {
    strategy: 'Iron Condor',
    category: 'Volatility Plays',
    direction: 'Neutral',
    riskType: 'defined',
    mechanics: 'Combine a bear call credit spread and a bull put credit spread on the same expiration — sell an out-of-the-money call spread and an out-of-the-money put spread at the same time.',
    maxGain: 'The net credit received from both spreads combined.',
    maxLoss: 'The wider of the two spread widths, minus the total credit received.',
    bestUsed: 'No strong directional view, expecting the stock to stay in a range, and implied volatility running elevated (rich premium on both sides).',
    watchOutFor: 'A move that breaks either side turns a small capped win into a much larger capped loss — this strategy actively loses on any big surprise move, even good news, since it needs the stock to stay range-bound.',
    howToManage: 'Same credit-spread rules on both sides: close for a profit around 50% of the total credit received, cut the loss once either side’s cost to close roughly doubles the credit received, and treat ~21 days to expiration as a checkpoint to close or roll rather than hold through the final stretch.',
    bestFitFor: ['Low–moderate capital', 'Income seekers', 'Conservative–moderate'],
  },
  {
    strategy: 'Long Straddle / Strangle',
    category: 'Volatility Plays',
    direction: 'Neutral',
    riskType: 'defined',
    mechanics: 'Buy both a call and a put — same strike for a straddle, different (further apart) strikes for a strangle — typically near the current price.',
    maxGain: 'Theoretically unlimited on the upside, substantial on the downside — but only past a breakeven point in either direction, since the winning leg first has to cover what was paid for both legs combined.',
    maxLoss: 'The combined premium paid for both legs — this is what you lose if the stock finishes between the two breakeven points (i.e. doesn’t move far enough), including sitting still.',
    bestUsed: "Expecting a big move but unsure of direction — either implied volatility is cheap (buying premium at a discount), or there's a known catalyst like earnings that justifies paying up anyway.",
    watchOutFor: 'Only one leg can ever finish in the money, and that side must clear the combined premium of both legs just to break even — a small move, or no move at all, loses on the position overall even though "the right side" technically gained a little.',
    howToManage: 'Both legs sit near 0.50 delta (a straddle) or somewhat below it (an OTM strangle). Common heuristic: take profit around 30–50% of the combined premium paid, and cut the loss around 30% rather than watching both legs decay toward zero. Time decay hurts twice as fast here since two legs are bleeding theta at once, so this is especially sensitive to the ~21-day mark.',
    bestFitFor: ['Low–moderate capital', 'Volatility seekers', 'Moderate–aggressive'],
  },
];

export default function OptionsStrategyGuidePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/options-strategy" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          ← Back to Options Strategy
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Strategy Guide</h1>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-2xl mx-auto">
          Plain-language explanations of every strategy this tool can suggest — mechanics, max gain/loss, and when
          each one tends to fit. Not investment advice; understand a strategy's full risk profile before using it.
        </p>

        <div className="mt-10 space-y-10">
          {CATEGORY_ORDER.map((category) => {
            const items = STRATEGY_GUIDE.filter((s) => s.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category}>
                <div className="mb-4 border-b border-gray-800 pb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-300">{category}</h2>
                  <p className="mt-1 text-xs text-gray-500">{CATEGORY_BLURBS[category]}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {items.map((s) => (
                    <div
                      key={s.strategy}
                      id={strategySlug(s.strategy)}
                      className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 flex flex-col scroll-mt-20"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white text-base">{s.strategy}</h3>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${DIRECTION_STYLES[s.direction]}`}
                        >
                          {s.direction}
                        </span>
                        <span
                          className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${RISK_TYPE_STYLES[s.riskType]}`}
                        >
                          {RISK_TYPE_LABELS[s.riskType]}
                        </span>
                      </div>

                      {s.note && (
                        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
                          {s.note}
                        </div>
                      )}

                      <div className="mt-3 space-y-2.5 text-xs text-gray-400 leading-relaxed">
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">
                            How it works
                          </span>
                          {s.mechanics}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-400 mb-0.5">
                              Max gain
                            </span>
                            <span className="text-gray-300">{s.maxGain}</span>
                          </div>
                          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-400 mb-0.5">
                              Max loss
                            </span>
                            <span className="text-gray-300">{s.maxLoss}</span>
                          </div>
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-500/80 mb-0.5">
                            Best used when
                          </span>
                          {s.bestUsed}
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-500/80 mb-0.5">
                            Watch out for
                          </span>
                          {s.watchOutFor}
                        </div>
                        {s.howToManage && (
                          <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-cyan-500/80 mb-0.5">
                              How to manage it
                            </span>
                            {s.howToManage}
                          </div>
                        )}
                        {s.bestFitFor?.length > 0 && (
                          <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                              Best fit for
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {s.bestFitFor.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 whitespace-nowrap"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {category === 'Covered & Cash-Secured' && (
                  <div className="mt-5 rounded-xl border border-gray-700 bg-gray-800/40 p-5">
                    <h3 className="font-semibold text-white text-sm">The Wheel</h3>
                    <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
                      Cash-Secured Put and Covered Call chain together into a repeating income cycle. Sell a
                      cash-secured put; if it expires worthless, keep the premium and sell another. If you get
                      assigned instead, you now own the shares — so sell a covered call against them. If that
                      expires worthless, keep the premium and sell another. If the shares get called away instead,
                      you're back to cash — so sell another cash-secured put, and the cycle repeats.
                    </p>
                    <div className="mt-2 max-w-md mx-auto rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 leading-relaxed text-center">
                      Not a guaranteed profit loop — the stock's price still moves against you like it would if you
                      just held the shares outright.
                    </div>
                    <div className="mt-4 flex justify-center">
                      <div className="rounded-xl bg-white p-3 max-w-sm w-full">
                        <img src="/images/wheel-strategy.webp" alt="The Wheel Strategy cycle diagram" className="w-full h-auto" />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
