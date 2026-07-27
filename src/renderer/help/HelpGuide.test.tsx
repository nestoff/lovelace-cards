import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpGuide } from "./HelpGuide";

describe("HelpGuide", () => {
  it("renders the complete camera setup and password guide", () => {
    render(<HelpGuide />);

    expect(
      screen.getByRole("heading", { name: "DITBrowse Help Guide", level: 1 })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Quick Start" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Camera Setup" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Passwords and Sign-In" })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Troubleshooting" })).toBeVisible();
    expect(screen.getAllByText(/positive whole number/i)).not.toHaveLength(0);
    expect(
      screen.getAllByText(/Sign out, forget login & reload selected/)
    ).not.toHaveLength(0);
  });

  it("uses local section links without opening another page", () => {
    render(<HelpGuide />);

    const cameraSetup = screen.getByRole("link", { name: "Camera Setup" });
    expect(cameraSetup).toHaveAttribute("href", "#help-camera-setup");
    fireEvent.click(cameraSetup);
    expect(screen.getByRole("heading", { name: "Camera Setup" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Main Page Controls" })).toHaveAttribute(
      "href",
      "#help-main-controls"
    );
  });

  it("explains every main workspace control exactly once", () => {
    render(<HelpGuide />);
    const reference = screen.getByLabelText("Main Page Controls reference");
    const labels = [
      "Camera tab",
      "Close tab",
      "Add tile",
      "Help",
      "Camera List",
      "Back",
      "Forward",
      "Camera Session",
      "Address",
      "Open address",
      "Open address in new tile",
      "Save current URL to camera list",
      "Use list address",
      "Focus selected page / Show all pages",
      "Cols",
      "Selected camera zoom",
      "Selected zoom percentage / reset",
      "All",
      "All relative zoom",
      "All relative percentage / reset",
      "Resolution",
      "Apply to All"
    ];

    for (const label of labels) {
      expect(within(reference).getAllByText(label, { exact: true })).toHaveLength(1);
    }
  });

  it("renders nine accessible annotated stills with matching numbered captions", () => {
    const { container } = render(<HelpGuide />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(9);
    expect(screen.getByAltText(/Main tab row annotated/i)).toBeVisible();
    expect(screen.getByAltText(/Navigation and address toolbar annotated/i)).toBeVisible();
    expect(screen.getByAltText(/Layout toolbar annotated/i)).toBeVisible();
    for (const image of images) {
      expect(image).toHaveAttribute("alt");
      expect(image.getAttribute("alt")?.trim()).not.toBe("");
    }

    const figures = Array.from(container.querySelectorAll("figure"));
    expect(figures).toHaveLength(9);
    for (const figure of figures) {
      expect(figure.querySelector("figcaption")).not.toBeNull();
      const calloutNumbers = Array.from(
        figure.querySelectorAll<HTMLElement>(".help-callout-number")
      ).map((marker) => marker.textContent);
      expect(new Set(calloutNumbers).size).toBe(calloutNumbers.length);
    }

    const sessionFigure = screen
      .getByAltText(/Camera Session menu/i)
      .closest("figure");
    expect(sessionFigure).not.toBeNull();
    expect(within(sessionFigure!).getByText("Reload selected")).toBeVisible();
    expect(
      within(sessionFigure!).getByText("Sign out, forget login & reload selected")
    ).toBeVisible();
  });
});
