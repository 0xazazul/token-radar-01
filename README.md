# Token Radar

A token launch radar: 198 pre-token protocols from a DefiLlama snapshot, ranked by
implied value, each with a farm plan. Built for the make.fun token-radar-01 bounty.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot at
`/input/snapshot.json` (or `--input <snapshot.json|directory>`), scores every
rankable pre-token protocol, and writes `/output/board.json`, `/output/data.js`,
`/output/dashboard/`, `/output/screenshots/` and `/output/dossier.json`.

Run it locally:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../kit/input/snapshot.json
```

## The model (radar-3.1)

Implied value follows only from the snapshot's own figures:

```
implied = round( size_curve_value x category_factor x growth_mult x maturity_mult )
```

- **size_curve_value** — the market's own size curve, fitted at run time by least
  squares on the snapshot's live-token protocols: `ln(mcap / (growth x maturity)) =
  a + b x ln(TVL)`. On this snapshot `a = 7.27`, `b = 0.53`, R² 0.19 over 128 live
  protocols. A slope below 1 is the point: a bigger protocol earns a lower multiple
  on its TVL, so the giants no longer top the board on size alone.
- **category_factor** — the category's own record against that curve: the median
  residual of the live protocols in the same category, shrunk by `n / (n + 5)` and
  clamped to [0.67, 1.50], applied only when at least 3 live peers carry the category,
  else 1.00 — no adjustment from too few peers.
- **growth_mult** — `1 + clamp(change_7d, -80, 200) / 100 x 0.6` when growing,
  `x 0.9` when falling: a falling TVL hurts more than a rising one helps.
- **maturity_mult** — `0.5 + min(age_days, 1460) / 1460 x 0.5`; an unreported age
  uses the ranked set's own median age (418 days).

The model checks itself at run time: leave-one-out against the 128 live-token
protocols the snapshot already prices — median log error 1.29, 34% within 2x, rank
correlation 0.40 — against 1.63 / 28% / 0.42 for the naive TVL x snapshot-median
multiple. Every prediction in that check is out of sample: the protocol being
predicted is left out before the curve and the factor are refitted, so it never
enters its own prediction. The dashboard shows both sets of numbers beside the fit, R² included.

No protocol name is special-cased. The dashboard recomputes every row from the
same figures and checks the number `board.json` carries.

## What gets ranked

The board covers all 40 watchlist protocols plus 158 more pre-token protocols the
rule keeps — 198 rows. Wrapped, staked and bridged products, versioned pools,
exchanges and CEX protocols are set aside, not ranked as launches: they are
products of tokens that already trade, by the same rule the watchlist uses.
Live-token protocols are shown apart with their market caps, which calibrate the
model. A protocol is said to *record no token*, never to have none.

## Farm plans and their verdicts

Seven steps per protocol, derived from its category, chains, TVL and age: a main
action and a second qualifying action for the category, a weekly cadence, a hold
period, the category's main risk, and a claim-safely step. Every step states what
it costs and how long it takes.

Every row also carries a netted verdict — farm, thin or skip — from the plan's own
figures. The plan spends gas (two transactions at the chain's stated gas, plus
about $2 of gas a week over the hold period) and the farmer's time (the plan's
active minutes at $25 an hour; the hold period is calendar time, not work). The
deployed capital stays in the position and is not a cost. Then:

```
net          = implied value - (gas + time cost)
net multiple = net / TVL
verdict      = farm at a net multiple of 0.40 or above, thin at 0.20 or above,
               skip below
```

On this snapshot that is 55 farm, 79 thin and 64 skip, with the same thresholds
for every row. Rank is the size of the prize in dollars; the verdict is the value
per dollar locked — so the two can disagree, and they do: the giants top the
board on absolute value and score skip on value per dollar, because the size
curve gives them the lowest multiples. The verdict is a screen, not a payout
promise: it does not promise the farmer a share of the implied value, which
depends on the airdrop program's own rules.

## The dashboard

A static page with no network and no framework: a sortable, filterable board
(search, category, chain, minimum TVL, watchlist-only, growing-only, farm verdict),
a top-5 spotlight, a live-token view, a detail drawer per protocol with the full model
breakdown, the netted farm verdict with its arithmetic, and its farm plan, and a model
panel that shows the fitted size curve and the leave-one-out backtest against the naive
multiple.

## License

MIT — see `LICENSE`.
