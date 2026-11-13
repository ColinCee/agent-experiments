import { expect, test } from "vitest";
import { href, parseHash } from "./routes";

test("a hash names a page and optionally a target on it", () => {
  expect(parseHash("#/trials")).toMatchObject({ page: { id: "trials" }, target: null });
  expect(parseHash("#/mistakes/tests-skipped")).toMatchObject({ page: { id: "mistakes" }, target: "tests-skipped" });
});

test("no hash or an unknown one opens the overview", () => {
  expect(parseHash("").page.id).toBe("overview");
  expect(parseHash("#/").page.id).toBe("overview");
  expect(parseHash("#/nowhere").page.id).toBe("overview");
});

test("links round-trip through the hash", () => {
  expect(parseHash(href("mistakes", "a-b"))).toMatchObject({ page: { id: "mistakes" }, target: "a-b" });
  expect(href("overview")).toBe("#/");
});
