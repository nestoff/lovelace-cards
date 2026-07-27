import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanionModuleSetupDialog } from "./CompanionModuleSetupDialog";

describe("CompanionModuleSetupDialog", () => {
  it("shows Companion's exact developer-module setup labels", () => {
    render(
      <CompanionModuleSetupDialog
        busy={false}
        error=""
        onClose={vi.fn()}
        onChoose={vi.fn(async () => false)}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Set Up the Companion Module" });
    expect(dialog).toHaveTextContent("Advanced Settings");
    expect(dialog).toHaveTextContent("Developer");
    expect(dialog).toHaveTextContent("Enable Developer Modules");
    expect(dialog).toHaveTextContent("Developer Modules Path");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Choose Folder & Install" })).toBeEnabled();
  });

  it("closes only after a folder selection installs successfully", async () => {
    const onClose = vi.fn();
    const onChoose = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    render(
      <CompanionModuleSetupDialog
        busy={false}
        error=""
        onClose={onClose}
        onChoose={onChoose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose Folder & Install" }));
    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Choose Folder & Install" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("shows setup errors and supports explicit cancellation", () => {
    const onClose = vi.fn();
    const onChoose = vi.fn(async () => false);
    render(
      <CompanionModuleSetupDialog
        busy={false}
        error="Permission denied."
        onClose={onClose}
        onChoose={onChoose}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Permission denied.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
