import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bluePillSwp08Fields, Swp08SetupGuide } from "./Swp08SetupGuide";

describe("Swp08SetupGuide", () => {
  it("maps Blue Pill Configurable Model fields from server info", () => {
    expect(
      bluePillSwp08Fields({
        enabled: true,
        host: "192.168.60.100",
        port: 8910,
        matrix: 0,
        levels: 1,
        sources: 64,
        destinations: 1,
        focusDestination: 1,
        listening: true,
        clientCount: 1
      })
    ).toEqual({
      ip: "192.168.60.100",
      port: 8910,
      matrixId: 0,
      sources: 64,
      destinations: 1,
      levels: 1,
      focusDestination: 1
    });
  });

  it("renders the Configurable Model field table", () => {
    render(
      <Swp08SetupGuide
        info={{
          enabled: true,
          host: "192.168.60.100",
          port: 8910,
          matrix: 0,
          levels: 1,
          sources: 64,
          destinations: 1,
          focusDestination: 1,
          listening: true,
          clientCount: 0
        }}
      />
    );

    expect(screen.getByLabelText("Blue Pill SW-P-08 setup guide")).toBeInTheDocument();
    expect(screen.getByText("Configurable Model fields (match Blue Pill exactly)")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Port/i })).toHaveTextContent("8910");
    expect(screen.getByRole("row", { name: /MatrixID/i })).toHaveTextContent("0");
    expect(screen.getByRole("row", { name: /IP/i })).toHaveTextContent("192.168.60.100");
    expect(
      screen.getByText((_, node) => node?.textContent === "Do not leave 0 — use the SW-P-08 port above (default 8910).")
    ).toBeInTheDocument();
  });
});
