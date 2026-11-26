import numpy as np

from agent_experiments.stats import compare, compare_paired, rate_range
from agent_experiments.verdicts import MIN_TASKS, call


def tasks(rng: np.random.Generator, n: int, miss_rate: float) -> np.ndarray:
    """Tasks as they really come: a few chances each, most often 1 to 10, and misses that clump within a task."""
    chances = 1 + np.floor(rng.random(n) ** 2 * 30)
    prone = np.where(rng.random(n) < miss_rate * 1.5, 0.66, 0.0)  # some tasks miss often, the rest never
    return np.column_stack([chances, rng.binomial(chances.astype(int), prone)])


def verdict(rng: np.random.Generator, rate_before: float, rate_after: float) -> str:
    """A trial judged as daily judges one, at the sizes real ones have: weeks of tasks before, three days after."""
    before = tasks(rng, int(rng.integers(30, 151)), rate_before)
    after = tasks(rng, int(rng.integers(5, 16)), rate_after)
    effect = compare(before, after, rng, resamples=99)
    return call(-effect.high, -effect.low, min(len(before), len(after)) >= MIN_TASKS)


def test_before_and_after_rarely_call_a_change_that_does_nothing():
    rng = np.random.default_rng(7)
    runs = 300
    called = [verdict(rng, 0.4, 0.4) for _ in range(runs)]
    assert called.count("works") / runs < 0.07
    assert called.count("worse") / runs < 0.07


def test_a_change_that_removes_most_misses_works():
    rng = np.random.default_rng(8)
    assert sum(verdict(rng, 0.5, 0.1) == "works" for _ in range(40)) > 20


def test_a_replay_sees_a_drop_in_the_same_moments():
    rng = np.random.default_rng(9)
    old = tasks(rng, 30, 0.5)
    new = np.column_stack([old[:, 0], np.floor(old[:, 1] / 2)])
    effect = compare_paired(old, new, rng)
    assert effect.drop > 0.4
    assert effect.p < 0.05
    assert effect.low > 0


def test_a_rate_range_holds_the_rate_and_narrows_with_more_tasks():
    rng = np.random.default_rng(10)
    few, many = tasks(rng, 10, 0.4), tasks(rng, 200, 0.4)
    rate, low, high = rate_range(few, rng)
    assert rate == few[:, 1].sum() / few[:, 0].sum()
    assert low <= rate <= high
    _, low_many, high_many = rate_range(many, rng)
    assert high_many - low_many < high - low
    assert np.isnan(rate_range(few[:1], rng)[1])
