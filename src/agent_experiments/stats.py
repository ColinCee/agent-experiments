"""How sure a rule's effect is, from chances and misses counted per task (docs/architecture.md#method).

Misses clump within a task, so tasks are shuffled and resampled whole, never single chances. SciPy does both; the
statistics get arrays of task indices and look the counts up, so one call handles every resample at once.
"""

import warnings
from dataclasses import dataclass

import numpy as np
from scipy import stats

USEFUL_DROP = 0.3  # a drop smaller than this is not worth a rule's place in the every-turn file
RESAMPLES = 99_999  # the first look's limit is p < 0.0003, which needs steps of p well below it
BOOTSTRAPS = 9_999
# Resamples held in memory at once: all 99,999 for 60 against 500 tasks took 2 GB, a thousand take about 20 MB and
# run no slower.
BATCH = 1_000
POWER_SIZES = (10, 20, 40, 80, 160, 320)
POWER_RUNS = 200


@dataclass(frozen=True)
class Effect:
    off: float  # share of chances missed without the rule
    on: float
    drop: float  # 1 - on / off: 0.5 is a halving, below 0 is worse
    low: float  # 90% range of the drop
    high: float
    p: float  # one-sided: how often shuffled groups show the rule's group missing at least this much less


def compare(off, on, rng: np.random.Generator, resamples: int = RESAMPLES) -> Effect:
    """Two groups of tasks, each rows of (chances, misses): without the rule and with it."""
    return _effect(off, on, rng, resamples, paired=False)


def compare_paired(old, new, rng: np.random.Generator, resamples: int = RESAMPLES) -> Effect:
    """The same moments answered under the old and the new rule: row i of each is one session's (chances, misses)."""
    return _effect(old, new, rng, resamples, paired=True)


def tasks_needed(recent, limit: float, rng: np.random.Generator) -> int | None:
    """Tasks per group at which one look at `limit` finds a true halving 80% of the time, simulated from a measure's
    recent tasks (rows of chances, misses); None when even the largest size tried falls short."""
    recent = np.asarray(recent, dtype=float).reshape(-1, 2)
    if len(recent) < 10 or recent[:, 1].sum() == 0:
        return None
    for n in POWER_SIZES:
        found = 0
        for _ in range(POWER_RUNS):
            off = recent[rng.integers(len(recent), size=n)]
            on = recent[rng.integers(len(recent), size=n)]
            on[:, 1] = rng.binomial(on[:, 1].astype(int), 0.5)
            found += _effect(off, on, rng, 999, paired=False, ranges=False).p < limit
        if found >= 0.8 * POWER_RUNS:
            return n
    return None


def _effect(off, on, rng: np.random.Generator, resamples: int, paired: bool, ranges: bool = True) -> Effect:
    off, on = np.asarray(off, dtype=float).reshape(-1, 2), np.asarray(on, dtype=float).reshape(-1, 2)
    chances = np.concatenate([off[:, 0], on[:, 0]])
    misses = np.concatenate([off[:, 1], on[:, 1]])
    i_off, i_on = np.arange(len(off)), np.arange(len(off), len(chances))

    def rate(idx):
        idx = idx.astype(np.intp)
        with np.errstate(divide="ignore", invalid="ignore"):
            return misses[idx].sum(axis=-1) / chances[idx].sum(axis=-1)

    def drop(x, y, axis=-1):
        r_off, r_on = rate(x), rate(y)
        with np.errstate(divide="ignore", invalid="ignore"):
            return np.where(r_off > 0, 1 - r_on / r_off, np.nan)

    # Paired: "samples" swaps old and new within a session, and the bootstrap draws whole sessions with both answers.
    p = stats.permutation_test(
        (i_off, i_on),
        lambda x, y, axis=-1: rate(x) - rate(y),
        permutation_type="samples" if paired else "independent",
        vectorized=True,
        n_resamples=resamples,
        batch=BATCH,
        alternative="greater",
        rng=rng,
    ).pvalue
    low = high = np.nan
    if ranges and min(len(off), len(on)) > 1:
        # A resample with no misses without the rule has no drop. SciPy's own interval turns NaN and warns, so the
        # range is taken here from its resamples, leaving those out.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", stats.DegenerateDataWarning)
            boot = stats.bootstrap(
                (i_off, i_on),
                drop,
                paired=paired,
                vectorized=True,
                n_resamples=BOOTSTRAPS,
                batch=BATCH,
                confidence_level=0.9,
                method="percentile",
                rng=rng,
            ).bootstrap_distribution
        if not np.isnan(boot).all():
            low, high = (float(q) for q in np.nanquantile(boot, [0.05, 0.95]))
    return Effect(float(rate(i_off)), float(rate(i_on)), float(drop(i_off, i_on)), low, high, float(p))
