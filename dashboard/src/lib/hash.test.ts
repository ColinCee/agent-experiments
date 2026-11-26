import { expect, test } from "vitest";
import { pickedRow, rowHref } from "./hash";

test("a link names a row as a plain hash, and every older form of link still opens its row", () => {
  const ids = ["trial-a-trial", "trial-a-rule"];
  expect(rowHref("trial-a-rule")).toBe("#trial-a-rule");
  expect(pickedRow("#trial-a-rule", ids)).toBe("trial-a-rule");
  expect(pickedRow("#/?m=trial-a-trial", ids)).toBe("trial-a-trial");
  expect(pickedRow("#/mistakes/a-rule", ids)).toBe("trial-a-rule");
  expect(pickedRow("#/?m=mistake-a-rule", ids)).toBe("trial-a-rule");
  expect(pickedRow("#/?m=replay-a-trial", ids)).toBe("trial-a-trial");
});

test("a link to nothing, or to a section that is gone, opens the page with no row picked", () => {
  const ids = ["trial-a-trial"];
  for (const hash of ["", "#", "#/", "#/trials", "#/size", "#/?m=size-rules", "#unknown"]) {
    expect(pickedRow(hash, ids), hash).toBeNull();
  }
});
