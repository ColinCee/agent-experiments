import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";
import { fixture } from "./data/fixture";

test("the page shows the report's day", () => {
  render(<App report={fixture} />);
  expect(screen.getByTestId("day")).toHaveTextContent(fixture.day);
});
