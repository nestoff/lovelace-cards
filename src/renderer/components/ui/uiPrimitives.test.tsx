import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { IconButton } from "./IconButton";
import { StatusNotice } from "./StatusNotice";

afterEach(() => {
  vi.useRealTimers();
});

describe("descriptive tooltips", () => {
  it("shows a descriptive tooltip after the pointer delay", () => {
    vi.useFakeTimers();
    render(
      <Button
        aria-label="Reload camera"
        tooltip={{
          title: "Reload camera",
          description: "Loads this tile again from its base address.",
          shortcut: "⌘R"
        }}
      >
        Reload
      </Button>
    );

    const trigger = screen.getByRole("button", { name: "Reload camera" });
    expect(trigger).not.toHaveAttribute("title");
    fireEvent.pointerEnter(trigger);
    act(() => vi.advanceTimersByTime(399));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Reload camera");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Loads this tile again from its base address."
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("⌘R");
  });

  it("shows on keyboard focus and closes with Escape", () => {
    render(
      <IconButton
        label="Workspace tools"
        tooltip={{
          title: "Workspace tools",
          description: "Manage jobs, camera lists, passwords, and session data."
        }}
        icon={<span>icon</span>}
      />
    );

    const trigger = screen.getByRole("button", { name: "Workspace tools" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeVisible();
    expect(trigger).toHaveAttribute("aria-describedby");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes when the tooltip trigger is activated", () => {
    render(
      <IconButton
        label="Workspace tools"
        tooltip={{
          title: "Workspace tools",
          description: "Manage jobs and camera lists."
        }}
        icon={<span>icon</span>}
      />
    );

    const trigger = screen.getByRole("button", { name: "Workspace tools" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeVisible();

    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("labels itself and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog
        title="Clear camera data?"
        description="This signs the camera out and reloads its base address."
        onClose={onClose}
        actions={<Button variant="primary">Clear and reload</Button>}
      >
        <p>Saved passwords are kept.</p>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Clear camera data?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Saved passwords are kept.");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("StatusNotice", () => {
  it("uses status semantics for progress and alert semantics for errors", () => {
    const { rerender } = render(
      <StatusNotice tone="progress" message="Clearing camera data" />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Clearing camera data");

    rerender(<StatusNotice tone="error" message="Camera data could not be cleared" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Camera data could not be cleared"
    );
  });
});
