import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CameraSessionMenu } from "./CameraSessionMenu";

function renderMenu(
  overrides: Partial<React.ComponentProps<typeof CameraSessionMenu>> = {}
) {
  const props: React.ComponentProps<typeof CameraSessionMenu> = {
    canReloadSelected: true,
    canReloadAll: true,
    busy: false,
    onReloadSelected: vi.fn(),
    onReloadAll: vi.fn(),
    onSignOutSelected: vi.fn(),
    onRequestSignOutAll: vi.fn(),
    ...overrides
  };

  render(<CameraSessionMenu {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Camera Session" }));
  return props;
}

describe("CameraSessionMenu", () => {
  it("shows safe reloads before explicitly destructive sign-out actions", () => {
    renderMenu();

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Reload selected",
      "Reload all",
      "Sign out, forget login & reload selected",
      "Sign out, forget active-list logins & reload all…"
    ]);
    expect(screen.getByRole("separator")).toBeVisible();
  });

  it.each([
    ["Reload selected", "onReloadSelected"],
    ["Reload all", "onReloadAll"],
    ["Sign out, forget login & reload selected", "onSignOutSelected"],
    [
      "Sign out, forget active-list logins & reload all…",
      "onRequestSignOutAll"
    ]
  ] as const)("runs %s once and closes the menu", (label, callback) => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: label }));

    expect(props[callback]).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and outside pointer input", () => {
    renderMenu();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Camera Session" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("disables selected-camera actions without a selected tile", () => {
    renderMenu({ canReloadSelected: false });

    expect(screen.getByRole("menuitem", { name: "Reload selected" })).toBeDisabled();
    expect(
      screen.getByRole("menuitem", {
        name: "Sign out, forget login & reload selected"
      })
    ).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Reload all" })).toBeEnabled();
  });

  it("disables every action while session cleanup is busy", () => {
    renderMenu({ busy: true });

    for (const item of screen.getAllByRole("menuitem")) {
      expect(item).toBeDisabled();
    }
  });

  it("marks only sign-out actions as destructive", () => {
    renderMenu();

    expect(screen.getByRole("menuitem", { name: "Reload selected" })).not.toHaveClass(
      "camera-session-danger"
    );
    expect(
      screen.getByRole("menuitem", {
        name: "Sign out, forget login & reload selected"
      })
    ).toHaveClass("camera-session-danger");
    expect(
      screen.getByRole("menuitem", {
        name: "Sign out, forget active-list logins & reload all…"
      })
    ).toHaveClass("camera-session-danger");
  });
});
