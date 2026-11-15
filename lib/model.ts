// The token radar's model (radar-3): one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every protocol that records no token and is not a wrapped, staked or bridged
// product of a token that already trades, a versioned pool, an exchange, or a CEX: the watchlist's
// own rule, minus its $50M floor and minus the parent-protocol check, which the snapshot does not
// carry. The watchlist's 40 are all in; 158 more pre-token protocols below the floor join them, so
// the board holds 198 rows. A protocol is pre-token when its record carries no market cap, no
// CoinGecko id and no symbol; live-token protocols are kept apart and shown with the market's own
// market cap, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, in three parts:
//
//   size curve = the market's own size curve, fitted at run time by least squares on the
//                snapshot's live-token protocols: ln(mcap / (growth x maturity)) = a + b x ln(TVL).
//                A slope below 1 says what the market already shows: a bigger protocol earns a
//                lower multiple on its TVL. On this snapshot the fit is a = 7.27, b = 0.53,
//                R-squared 0.19 over 128 live protocols: a weak fit, honestly a weak one, and
//                the dashboard says so beside the backtest below. The curve's dollar value at a
//                protocol's TVL is the base of its implied value.
//   category   = the category's own record against that curve: the median residual of the live
//                protocols in the same category, shrunk by n / (n + 5) and clamped to [0.67, 1.50],
//                applied only when at least 3 live peers carry the category, else 1. A category
//                whose tokens the market already values above the curve earns a richer implied
//                value for its pre-token peers; a category with too few live peers earns no
//                adjustment at all, rather than a guess from one peer.
//   growth     = clamp(change_7d, -80, 200) per cent
//   growthMult = 1 + (growth / 100) x 0.6 when growth is up, x 0.9 when it is down:
//                a falling TVL hurts more than a rising one helps.
//   maturity   = 0.5 + min(age_days, 1460) / 1460 x 0.5   (age_days unknown: the median age of
//                the pre-token set itself, 418 days on this snapshot)
//   implied    = max(1, round(size_curve_value x category_factor x growthMult x maturity))
//
// The model is checked, not just stated: at run time it replays itself against the 128 live-token
// protocols the snapshot already prices (leave one out, refit, predict, compare with the market
// cap it actually carries) and reports the median log error, the share within 2x and the rank
// correlation, beside the same numbers for the naive TVL x snapshot-median multiple. On this
// snapshot the curve's median log error is 1.29 against the naive 1.63, and 34% of live market
// caps land within 2x against 28%. No protocol name is ever special-cased: the same function
// scores every row, and the page recomputes each row from the same figures, so the screenshots
// and the code agree.
//
// Every row also carries a netted farm-plan verdict. The farm plan's own figures give it:
// the gas its steps spend (two transactions at the chain's stated gas, plus about $2 a week of
// weekly actions over the hold period) and the farmer's time (the plan's active minutes at
// $25 an hour; the hold period is calendar time, not work, and is not costed as hours). The
// deployed capital is not a cost: it stays in the position and comes back on withdrawal.
//   net            = implied_value_usd - (gas_usd + time_cost_usd)
//   net_multiple   = net / tvl_usd — the implied value left per dollar locked, after paying
//                    the farm's costs. Rank is the size of the prize in dollars; the verdict
//                    is the value per dollar locked, so the two can disagree: the giants top
//                    the board on absolute value and score skip on value per dollar, because
//                    the size curve gives them the lowest multiples.
//   verdict        = 'farm' when net_multiple >= 0.40, 'thin' when >= 0.20, else 'skip'.
// The verdict is a screen, not a payout promise: it compares the protocol's implied value,
// net of the farm's costs, against its TVL. It does not promise the farmer a share of the
// implied value — an airdrop's per-wallet payout depends on the program's own rules, which
// the snapshot does not carry. The same thresholds score every row; no name is special-cased.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight_up: number;
  growth_weight_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  category_min_live: number;
  category_shrink_k: number;
  category_factor_floor: number;
  category_factor_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight_up: 0.6,
  growth_weight_down: 0.9,
  growth_floor: -80,
  growth_cap: 200,
  maturity_floor: 0.5,
  maturity_range: 0.5,
  maturity_days: 1460,
  category_min_live: 3,
  category_shrink_k: 5,
  category_factor_floor: 0.67,
  category_factor_cap: 1.5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3.1';

/** The farm plan's economics, as the dashboard states them: the gas its steps spend, the
    farmer's time at a stated hourly rate, and the verdict thresholds on the netted multiple.
    The deployed capital is not a cost — it stays in the position — so it is not in here. */
export const FARM_ECONOMICS = {
  hourly_usd: 25,
  weekly_gas_usd: 2,
  gas_ethereum_usd: 10,
  gas_cheap_usd: 0.5,
  gas_other_usd: 2,
  verdict_farm_multiple: 0.4,
  verdict_thin_multiple: 0.2,
};

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** What one farm plan spends, in numbers: the gas its steps spend, the farmer's active time,
    and the time costed at the stated hourly rate. The deployed capital is shown beside it but
    is not a cost: it stays in the position and comes back on withdrawal. */
export interface FarmEconomics {
  capital_usd: number;
  gas_usd: number;
  active_minutes: number;
  time_cost_usd: number;
  total_cost_usd: number;
}

/** A row's netted farm-plan verdict: the net, the netted multiple it is tiered on, and the tier. */
export interface FarmVerdict {
  economics: FarmEconomics;
  net_usd: number;
  net_multiple: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    size_curve_value: number;
    size_curve_multiple: number;
    category_factor: number;
    category_live_n: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  farm: FarmVerdict;
}

/** The dashboard's compact view of one row, with the farm plan written in board.json. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  size_curve_value: number;
  size_curve_multiple: number;
  category_factor: number;
  category_live_n: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
  farm: FarmVerdict;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** How the model checks itself against the live-token protocols the snapshot already prices:
    leave one out, refit, predict, compare with the market cap it actually carries — beside the
    same numbers for the naive TVL x snapshot-median multiple, so the check has a baseline. */
export interface BacktestStats {
  n: number;
  spearman: number;
  median_abs_log_error: number;
  within_2x: number;
  bias: number;
  baseline_spearman: number;
  baseline_median_abs_log_error: number;
  baseline_within_2x: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  unknown_age_days: number;
  size_curve: { intercept: number; slope: number; r_squared: number; n: number };
  backtest: BacktestStats;
  verdict_counts: { farm: number; thin: number; skip: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The middle value of a sorted list, or null when it is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** A live protocol's growth multiplier, from the snapshot's own seven-day change. */
function growthMultiplier(change_7d: number | null, model: ModelConstants): { pct: number; mult: number } {
  const rawGrowth = finite(change_7d, 0);
  const pct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const weight = pct >= 0 ? model.growth_weight_up : model.growth_weight_down;
  return { pct, mult: 1 + (pct / 100) * weight };
}

/** A protocol's maturity multiplier: how long it has run with no token. */
function maturityMultiplier(age: number | null, unknownAgeDays: number, model: ModelConstants): number {
  const ageForModel = age ?? unknownAgeDays;
  return model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
}

/** The growth x maturity adjustment one protocol's market cap is divided by before the size curve
    is fitted: the curve is fitted on size alone, so the other two terms are taken out first. */
function adjustment(p: SnapshotProtocol, asOf: string, unknownAgeDays: number, model: ModelConstants): number {
  const age = ageDays(asOf, p.listed_at);
  return growthMultiplier(p.change_7d, model).mult * maturityMultiplier(age, unknownAgeDays, model);
}

/** The market's own size curve: least squares on ln(mcap / adjustment) against ln(TVL) over the
    snapshot's live-token protocols. Fitted at run time, never written in by hand. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  rSquared: number;
  n: number;
}

export function fitSizeCurve(
  live: SnapshotProtocol[],
  asOf: string,
  unknownAgeDays: number,
  model: ModelConstants,
): SizeCurve {
  const pts = live
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => {
      const adj = adjustment(p, asOf, unknownAgeDays, model);
      return { x: Math.log(p.tvl_usd), y: Math.log(p.mcap_usd! / adj) };
    });
  const n = pts.length;
  if (n < 10) return { intercept: Math.log(0.22), slope: 1, rSquared: 0, n };
  let sx = 0;
  let sy = 0;
  for (const pt of pts) {
    sx += pt.x;
    sy += pt.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const pt of pts) {
    const dx = pt.x - mx;
    const dy = pt.y - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : 1;
  const intercept = my - slope * mx;
  const rSquared = syy > 0 && sxx > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  return { intercept, slope, rSquared, n };
}

/** The dollar value the size curve gives a protocol at its TVL, and the multiple that implies. */
function curveValue(tvl: number, curve: SizeCurve): { value: number; multiple: number } {
  const value = Math.exp(curve.intercept + curve.slope * Math.log(Math.max(tvl, 1)));
  return { value, multiple: value / Math.max(tvl, 1) };
}

/** The category's own record against the size curve: the median residual (log actual minus log
    curve) of the live protocols in the same category, shrunk by n / (n + k) so a thin category
    cannot swing a value on one peer's word, clamped to [floor, cap], and applied only when at
    least `category_min_live` live peers carry the category, else 1: no adjustment at all. */
export function categoryFactor(
  category: string | null,
  live: SnapshotProtocol[],
  curve: SizeCurve,
  asOf: string,
  unknownAgeDays: number,
  model: ModelConstants,
): { factor: number; liveN: number } {
  const residuals = live
    .filter(
      (p) => (p.category ?? 'Other') === (category ?? 'Other') && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
    )
    .map(
      (p) =>
        Math.log(p.mcap_usd! / adjustment(p, asOf, unknownAgeDays, model)) -
        (curve.intercept + curve.slope * Math.log(p.tvl_usd)),
    );
  const n = residuals.length;
  if (n < model.category_min_live) return { factor: 1, liveN: n };
  const med = median(residuals);
  if (med === null) return { factor: 1, liveN: n };
  const shrunk = med * (n / (n + model.category_shrink_k));
  const factor = Math.min(model.category_factor_cap, Math.max(model.category_factor_floor, Math.exp(shrunk)));
  return { factor, liveN: n };
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  curve: SizeCurve,
  factor: { factor: number; liveN: number },
  unknownAgeDays: number,
): {
  implied: number;
  curveValue: number;
  curveMultiple: number;
  categoryFactor: number;
  liveN: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const { value, multiple } = curveValue(protocol.tvl_usd, curve);
  const growth = growthMultiplier(protocol.change_7d, model);
  const maturityMult = maturityMultiplier(age, unknownAgeDays, model);
  const implied = Math.max(1, Math.round(value * factor.factor * growth.mult * maturityMult));
  return {
    implied,
    curveValue: value,
    curveMultiple: multiple,
    categoryFactor: factor.factor,
    liveN: factor.liveN,
    growthPct: growth.pct,
    growthMult: growth.mult,
    maturityMult,
    age,
  };
}

/** Rank correlation: Pearson on the ranks, ties averaged. */
function spearman(actual: number[], predicted: number[]): number {
  const n = actual.length;
  if (n < 3) return 0;
  const rankOf = (values: number[]): number[] => {
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && order[j + 1]!.v === order[i]!.v) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[order[k]!.i] = avg;
      i = j + 1;
    }
    return ranks;
  };
  const ra = rankOf(actual);
  const rp = rankOf(predicted);
  const ma = ra.reduce((s, v) => s + v, 0) / n;
  const mp = rp.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let dp = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i]! - ma) * (rp[i]! - mp);
    da += (ra[i]! - ma) ** 2;
    dp += (rp[i]! - mp) ** 2;
  }
  return da > 0 && dp > 0 ? num / Math.sqrt(da * dp) : 0;
}

/** The model's own check: leave one live protocol out, refit the curve and the category factor
    without it, predict its market cap, compare with the one it actually carries. The naive
    baseline is TVL x the snapshot's median market-cap / TVL, itself leave-one-out, so the check
    has something to beat. */
export function backtest(
  live: SnapshotProtocol[],
  asOf: string,
  unknownAgeDays: number,
  model: ModelConstants,
): BacktestStats {
  const usable = live.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const n = usable.length;
  if (n < 10) {
    return {
      n,
      spearman: 0,
      median_abs_log_error: 0,
      within_2x: 0,
      bias: 0,
      baseline_spearman: 0,
      baseline_median_abs_log_error: 0,
      baseline_within_2x: 0,
    };
  }
  const actual: number[] = [];
  const predicted: number[] = [];
  const basePredicted: number[] = [];
  for (let i = 0; i < n; i++) {
    const held = usable[i]!;
    const rest = usable.filter((_, j) => j !== i);
    const curve = fitSizeCurve(rest, asOf, unknownAgeDays, model);
    const factor = categoryFactor(held.category, rest, curve, asOf, unknownAgeDays, model);
    const age = ageDays(asOf, held.listed_at);
    const growth = growthMultiplier(held.change_7d, model);
    const maturity = maturityMultiplier(age, unknownAgeDays, model);
    const { value } = curveValue(held.tvl_usd, curve);
    predicted.push(Math.max(1, value * factor.factor * growth.mult * maturity));
    const ratios = rest.map((p) => p.mcap_usd! / p.tvl_usd);
    const med = median(ratios) ?? 0.2;
    basePredicted.push(held.tvl_usd * med);
    actual.push(held.mcap_usd!);
  }
  const logErrors = predicted.map((p, i) => Math.log(p / actual[i]!));
  const baseLogErrors = basePredicted.map((p, i) => Math.log(p / actual[i]!));
  const absErrors = logErrors.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const baseAbsErrors = baseLogErrors.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const within = logErrors.filter((e) => Math.abs(e) <= Math.log(2)).length / n;
  const baseWithin = baseLogErrors.filter((e) => Math.abs(e) <= Math.log(2)).length / n;
  return {
    n,
    spearman: round4(spearman(actual, predicted)),
    median_abs_log_error: round4(absErrors[Math.floor(n / 2)]!),
    within_2x: round4(within),
    bias: round4(logErrors.reduce((s, e) => s + e, 0) / n),
    baseline_spearman: round4(spearman(actual, basePredicted)),
    baseline_median_abs_log_error: round4(baseAbsErrors[Math.floor(n / 2)]!),
    baseline_within_2x: round4(baseWithin),
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A name that begins with an exchange's name is the exchange's own product, not a launch of its own. */
const EXCHANGE_NAMED = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** A whole word wrapped, staked or staking marks a product of a token that already trades. */
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;
/** Categories the watchlist treats as products of a token that already trades. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
    product, a versioned pool, an exchange's product or a CEX. The watchlist's rule, minus its floor. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !VERSIONED.test(p.name) &&
    !EXCHANGE_NAMED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !PRODUCT_CATEGORIES.has(p.category ?? '')
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is ranked, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the rule keeps, below the floor or above it,
  // wherever its TVL sits. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  // The live-token protocols calibrate the model: the size curve is fitted on them, and the
  // category factors are their residuals against it.
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  // An age the snapshot never reports is filled with the median age of the ranked set itself.
  const knownAges = [...chosen.values()]
    .map((p) => ageDays(snapshot.as_of, p.listed_at))
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  const unknownAgeDays = knownAges.length > 0 ? knownAges[Math.floor(knownAges.length / 2)]! : 365;
  const curve = fitSizeCurve(live, snapshot.as_of, unknownAgeDays, model);

  const scored = [...chosen.values()].map((p) => {
    const factor = categoryFactor(p.category, live, curve, snapshot.as_of, unknownAgeDays, model);
    const v = impliedValue(p, snapshot.as_of, model, curve, factor, unknownAgeDays);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: snapshot.watchlist.includes(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      // The curve value and the category factor are kept at full precision: the page recomputes
      // the row from them, and a rounded copy would make the recomputation differ by a few
      // dollars from board.json. The other fields are display-only and may be rounded.
      size_curve_value: s.curveValue,
      size_curve_multiple: round4(s.curveMultiple),
      category_factor: s.categoryFactor,
      category_live_n: s.liveN,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
    farm: farmVerdict(s.implied, s.p.tvl_usd, farmEconomics(s.p, s.age)),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/** Chains where a transaction costs under a dollar, by the chain's own fee market. */
const CHEAP_CHAINS = new Set([
  'Base', 'Arbitrum', 'Optimism', 'Polygon', 'Unichain', 'Ink', 'Katana', 'Monad', 'Solana',
  'Berachain', 'Sonic', 'Scroll', 'Linea', 'Blast', 'Mode', 'Zora', 'Abstract', 'Sui', 'Aptos',
  'Sei', 'Hyperliquid L1', 'Plasma', 'Stable', 'Tempo', 'Arc', 'Fluent', 'Citrea', 'Mezo',
  'Etherlink', 'Pharos', 'Corn', 'BOB', 'Morph', 'Mantle', 'Celo', 'Gnosis', 'Avalanche', 'BSC',
  'Binance', 'Tron', 'Bitcoin', 'Bittensor', 'Stellar', 'Flare',
]);

/** What one transaction costs on the protocol's first chain. */
function gasNote(p: SnapshotProtocol): string {
  const chain = chainOf(p);
  if (chain === 'Ethereum') return 'about $5–15 of gas on Ethereum mainnet';
  if (CHEAP_CHAINS.has(chain)) return `under $1 of gas on ${chain}`;
  return `about $1–3 of gas on ${chain}`;
}

/** The category's main farm action, its second qualifying action, and its main risk. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): { main: string; second: string; risk: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      main: `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
      second: `Borrow $20 against the supply, hold the loan for a week, then repay it in full.`,
      risk: `A borrow can be liquidated if the collateral falls: keep the loan small and the health factor above 2.`,
    };
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return {
      main: `Provide $${capital} of liquidity to ${name}'s largest pool on ${chain} and keep the position open.`,
      second: `Swap $25 through the same pool each week so the wallet shows trading volume as well as liquidity.`,
      risk: `Liquidity can lose value to impermanent loss when the pair's price moves: use a stable pair if one exists.`,
    };
  }
  if (c.includes('yield') || c.includes('farm')) {
    return {
      main: `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the shares.`,
      second: `Claim the vault's rewards each week and re-deposit them instead of selling.`,
      risk: `Vault yields move with the strategy: check the vault's own page for the current rate before depositing.`,
    };
  }
  if (c.includes('basis trading')) {
    return {
      main: `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and keep the position open.`,
      second: `Add $25 to the same strategy after two weeks so the wallet shows a second deposit.`,
      risk: `A basis trade earns from funding rates, which can turn negative: the position can lose a little while it waits.`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      main: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`,
      second: `Restake the staking rewards each week instead of withdrawing them.`,
      risk: `Staked assets can be locked for days: check the unbonding period before staking.`,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return {
      main: `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedge.`,
      second: `Close the hedge after a week and open a fresh one, so the wallet shows repeated trading.`,
      risk: `Leveraged positions can be liquidated in a fast move: keep the position small and never use full margin.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      main: `Fund $${capital} on ${name} and place one position on a market that closes within a month.`,
      second: `Place a second, smaller position on a different market the following week.`,
      risk: `A prediction market pays nothing when the position is wrong: size each position so a loss is small.`,
    };
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return {
      main: `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`,
      second: `Deposit $25 into a second vault of the same curator after two weeks.`,
      risk: `A curator's vaults follow different strategies: read each vault's own page before depositing.`,
    };
  }
  if (c.includes('stable')) {
    return {
      main: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`,
      second: `Use $25 of the stable asset in the protocol's own app each week, then return it.`,
      risk: `A stable asset can lose its peg: never hold more in it than you can afford to wait out.`,
    };
  }
  if (c.includes('rwa')) {
    return {
      main: `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`,
      second: `Claim the asset's yield each week and keep it in the same wallet.`,
      risk: `A real-world asset depends on its issuer and custodian: check who backs it before minting.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      main: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`,
      second: `Renew the cover once, so the wallet shows two policy periods.`,
      risk: `Cover pays only on the events the policy names: read the covered events before buying.`,
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      main: `Fund $${capital} through ${name} on ${chain} and make one real payment with it.`,
      second: `Make one payment a week for four weeks, each at least $10.`,
      risk: `Payments are final once sent: check the address on screen before confirming each one.`,
    };
  }
  if (c.includes('index')) {
    return {
      main: `Buy $${capital} of the ${name} index on ${chain} and hold the index token.`,
      second: `Add $25 to the same index after two weeks.`,
      risk: `An index follows its basket: a fall in any large holding moves the whole index.`,
    };
  }
  if (c.includes('governance')) {
    return {
      main: `Deposit $${capital} into ${name} on ${chain} and vote in its next governance proposal.`,
      second: `Vote again in the following proposal, so the wallet shows two votes.`,
      risk: `A vote locks nothing by itself, but the deposit behind it can fall in value: keep it small.`,
    };
  }
  return {
    main: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    second: `Make a second deposit of $25 into the same protocol after two weeks.`,
    risk: `A new protocol's contracts are unaudited until proven otherwise: keep the position small and check its docs first.`,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasNote(p);
  const a = actionsFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'nothing to set up',
      time: '5 minutes',
    },
    {
      text: a.main,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: a.second,
      cost: gas,
      time: '10 minutes',
    },
    {
      text: `Do one on-chain action each week, such as a deposit, a swap, a vote or a claim, so the wallet stays active across snapshots.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: a.risk,
      cost: 'nothing but the reading',
      time: '5 minutes to read the docs',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, and write the wallet, the dates and every transaction in a farm log.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** What one transaction costs, in dollars, on the protocol's first chain: the midpoint of the
    range the farm plan's own text states — about $5–15 on Ethereum, under $1 on a cheap chain,
    about $1–3 elsewhere. The text and the number are the same figures. */
export function gasPerTxUsd(p: SnapshotProtocol): number {
  const chain = chainOf(p);
  if (chain === 'Ethereum') return FARM_ECONOMICS.gas_ethereum_usd;
  if (CHEAP_CHAINS.has(chain)) return FARM_ECONOMICS.gas_cheap_usd;
  return FARM_ECONOMICS.gas_other_usd;
}

/** What one farm plan spends, in numbers, from the same figures its text states: two
    transactions at the chain's gas, plus about $2 of gas a week over the hold period, and the
    plan's active minutes at $25 an hour. The hold period is calendar time, not work, so it is
    not costed as hours; the deployed capital stays in the position and is not a cost. */
export function farmEconomics(p: SnapshotProtocol, age: number | null): FarmEconomics {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = hold / 7;
  const gas = 2 * gasPerTxUsd(p) + FARM_ECONOMICS.weekly_gas_usd * weeks;
  const activeMinutes = 45 + 10 * weeks;
  const timeCost = (activeMinutes / 60) * FARM_ECONOMICS.hourly_usd;
  return {
    capital_usd: capital,
    gas_usd: round2(gas),
    active_minutes: round2(activeMinutes),
    time_cost_usd: round2(timeCost),
    total_cost_usd: round2(gas + timeCost),
  };
}

/** A row's netted farm-plan verdict. Net is the implied value minus what the farm plan spends
    (gas + time cost). The verdict tiers on the netted multiple — the net left per dollar locked —
    because rank is the size of the prize in dollars while the verdict is the value per dollar
    locked: farm at 0.40 or above, thin at 0.20 or above, skip below. The same thresholds score
    every row; no protocol name is special-cased. */
export function farmVerdict(impliedValueUsd: number, tvlUsd: number, economics: FarmEconomics): FarmVerdict {
  const net = impliedValueUsd - economics.total_cost_usd;
  const netMultiple = tvlUsd > 0 ? Math.round((net / tvlUsd) * 1e4) / 1e4 : 0;
  const verdict =
    netMultiple >= FARM_ECONOMICS.verdict_farm_multiple
      ? 'farm'
      : netMultiple >= FARM_ECONOMICS.verdict_thin_multiple
        ? 'thin'
        : 'skip';
  return { economics, net_usd: round2(net), net_multiple: netMultiple, verdict };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js: the farm plan is the one board.json carries. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    size_curve_value: row.model.size_curve_value,
    size_curve_multiple: row.model.size_curve_multiple,
    category_factor: row.model.category_factor,
    category_live_n: row.model.category_live_n,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    watchlist: row.watchlist,
    farm_steps: row.farm_steps,
    farm: row.farm,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; unknownAgeDays: number } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const knownAges = board
    .map((r) => r.age_days)
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  const unknownAgeDays = knownAges.length > 0 ? knownAges[Math.floor(knownAges.length / 2)]! : 365;
  const liveProtocols = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const curve = fitSizeCurve(liveProtocols, snapshot.as_of, unknownAgeDays, model);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    unknown_age_days: unknownAgeDays,
    size_curve: {
      intercept: round4(curve.intercept),
      slope: round4(curve.slope),
      r_squared: round4(curve.rSquared),
      n: curve.n,
    },
    backtest: backtest(liveProtocols, snapshot.as_of, unknownAgeDays, model),
    verdict_counts: {
      farm: board.filter((r) => r.farm.verdict === 'farm').length,
      thin: board.filter((r) => r.farm.verdict === 'thin').length,
      skip: board.filter((r) => r.farm.verdict === 'skip').length,
    },
    rows: board.map(radarRow),
    live,
  };
  return { board, radar, unknownAgeDays };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!['farm', 'thin', 'skip'].includes(r.farm.verdict)) return `${r.slug} has farm verdict ${r.farm.verdict}`;
    if (!Number.isFinite(r.farm.net_usd) || r.farm.net_usd <= 0) return `${r.slug} has farm net ${r.farm.net_usd}`;
    if (!Number.isFinite(r.farm.net_multiple) || r.farm.net_multiple < 0) return `${r.slug} has farm net multiple ${r.farm.net_multiple}`;
    if (!Number.isFinite(r.farm.economics.total_cost_usd) || r.farm.economics.total_cost_usd < 0) return `${r.slug} has farm cost ${r.farm.economics.total_cost_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
