import numpy as np

from agent_experiments.looks import LOOK_SIZES, verdict
from agent_experiments.stats import compare, compare_paired

RESAMPLES = 10_000  # fewer than a real look's, but fine enough to place p against the first limit of 0.0003


def tasks(rng: np.random.Generator, n: int, miss_rate: float) -> np.ndarray:
    """Tasks as they really come: a few chances each, most often 1 to 10, and misses that clump within a task."""
    chances = 1 + np.floor(rng.random(n) ** 2 * 30)
    prone = np.where(rng.random(n) < miss_rate * 1.5, 0.66, 0.0)  # some tasks miss often, the rest never
    return np.column_stack([chances, rng.binomial(chances.astype(int), prone)])


def passes(rng: np.random.Generator, rate_off: float, rate_on: float) -> bool:
    """A trial run through its three looks: whether any said `works`."""
    off, on = tasks(rng, 40, rate_off), tasks(rng, 40, rate_on)
    return any(
        verdict(compare(off[:n], on[:n], rng, RESAMPLES), look, n) == "works"
        for look, n in enumerate(LOOK_SIZES, start=1)
    )


def test_three_looks_pass_a_rule_that_does_nothing_about_one_trial_in_twenty_at_most():
    rng = np.random.default_rng(7)
    runs = 300
    assert sum(passes(rng, 0.4, 0.4) for _ in range(runs)) / runs < 0.07


def test_a_rule_that_removes_most_misses_passes():
    rng = np.random.default_rng(8)
    assert sum(passes(rng, 0.5, 0.1) for _ in range(40)) > 32


def test_a_replay_sees_a_drop_in_the_same_moments():
    rng = np.random.default_rng(9)
    old = tasks(rng, 30, 0.5)
    new = np.column_stack([old[:, 0], np.floor(old[:, 1] / 2)])
    effect = compare_paired(old, new, rng)
    assert effect.drop > 0.4
    assert effect.p < 0.05
    assert effect.low > 0
