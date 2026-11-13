import { expect, test } from "vitest";
import { parseHash, selectHref } from "./hash";

test("the old pages' addresses open the page at their section", () => {
  expect(parseHash("#/trials")).toEqual({ section: "trials", selected: null });
  expect(parseHash("#/mistakes")).toEqual({ section: "rules", selected: null });
  expect(parseHash("#/size")).toEqual({ section: "size", selected: null });
  expect(parseHash("#/sizes").section).toBe("size");
  expect(parseHash("#/replays").section).toBe("replays");
  expect(parseHash("#/permanent").section).toBe("permanent");
});

test("an old link to one mistake picks it", () => {
  expect(parseHash("#/mistakes/ports-taken")).toEqual({ section: "rules", selected: "mistake-ports-taken" });
});

test("no hash or an unknown one is the top of the page", () => {
  expect(parseHash("")).toEqual({ section: null, selected: null });
  expect(parseHash("#/nowhere")).toEqual({ section: null, selected: null });
});

test("a pick rides in the hash and round-trips", () => {
  expect(parseHash(selectHref("trial-a-b"))).toEqual({ section: null, selected: "trial-a-b" });
  expect(selectHref(null)).toBe("#/");
});
