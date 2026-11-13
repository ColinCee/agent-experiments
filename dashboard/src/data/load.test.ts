import { afterEach, expect, test } from "vitest";
import { fixture } from "./fixture";
import { loadReport } from "./load";

function setReportTag(text: string) {
  document.body.innerHTML = `<script id="report" type="application/json">${text}</script>`;
}

afterEach(() => {
  document.body.innerHTML = "";
});

test("an unreplaced placeholder loads the fixture", () => {
  setReportTag("__REPORT__");
  expect(loadReport()).toBe(fixture);
});

test("an injected report is parsed", () => {
  const injected = { ...fixture, day: "2030-01-02" };
  setReportTag(JSON.stringify(injected).replaceAll("</", "<\\/"));
  expect(loadReport()).toEqual(injected);
});
