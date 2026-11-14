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

## The model (radar-2)

Implied value follows only from the snapshot's own figures:

```
implied = round( tvl_usd x category_multiple x growth_mult x maturity_mult )
```

- **category_multiple** — the median market-cap / TVL of the live-token protocols in
  the same category (at least 3 of them, else the snapshot's median, 0.2227),
  clamped to [0.08, 0.65]. It is computed from the snapshot at run time: a category
  whose tokens the market already values richly against TVL earns a richer implied
  value for its pre-token peers.
- **growth_mult** — `1 + clamp(change_7d, -80, 200) / 100 x 0.6` when growing,
  `x 0.9` when falling: a falling TVL hurts more than a rising one helps.
- **maturity_mult** — `0.5 + min(age_days, 1460) / 1460 x 0.5`; an unreported age
  uses the ranked set's own median age (418 days).

No protocol name is special-cased. The dashboard recomputes every row from the
same figures and checks the number `board.json` carries.

## What gets ranked

The board covers all 40 watchlist protocols plus 158 more pre-token protocols the
rule keeps — 198 rows. Wrapped, staked and bridged products, versioned pools,
exchanges and CEX protocols are set aside, not ranked as launches: they are
products of tokens that already trade, by the same rule the watchlist uses.
Live-token protocols are shown apart with their market caps, which calibrate the
model. A protocol is said to *record no token*, never to have none.

## Farm plans

Seven steps per protocol, derived from its category, chains, TVL and age: a main
action and a second qualifying action for the category, a weekly cadence, a hold
period, the category's main risk, and a claim-safely step. Every step states what
it costs and how long it takes.

## The dashboard

A static page with no network and no framework: a sortable, filterable board
(search, category, chain, minimum TVL, watchlist-only, growing-only), a top-5
spotlight, a live-token view, and a detail drawer per protocol with the full model
breakdown and its farm plan.

## License

MIT — see `LICENSE`.
