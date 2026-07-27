import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import type { WorkspaceState } from "../../shared/types";
import { useDebouncedWorkspaceSave } from "./useDebouncedWorkspaceSave";

describe("useDebouncedWorkspaceSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once with the latest workspace after the debounce delay", () => {
    const saveWorkspace = vi.fn();

    function Harness({
      workspace,
      loaded = true
    }: {
      workspace: WorkspaceState;
      loaded?: boolean;
    }): null {
      useDebouncedWorkspaceSave({ loaded, workspace, saveWorkspace, delayMs: 250 });
      return null;
    }

    const secondWorkspace = { ...sampleWorkspace, gridColumns: 3 };
    const latestWorkspace = { ...sampleWorkspace, gridColumns: 5 };

    const { rerender } = render(<Harness workspace={sampleWorkspace} />);

    rerender(<Harness workspace={secondWorkspace} />);
    act(() => vi.advanceTimersByTime(249));
    expect(saveWorkspace).not.toHaveBeenCalled();

    rerender(<Harness workspace={latestWorkspace} />);
    act(() => vi.advanceTimersByTime(250));

    expect(saveWorkspace).toHaveBeenCalledTimes(1);
    expect(saveWorkspace).toHaveBeenLastCalledWith(latestWorkspace);
  });

  it("does not schedule saves before the workspace has loaded", () => {
    const saveWorkspace = vi.fn();

    function Harness(): null {
      useDebouncedWorkspaceSave({
        loaded: false,
        workspace: sampleWorkspace,
        saveWorkspace,
        delayMs: 250
      });
      return null;
    }

    render(<Harness />);

    act(() => vi.advanceTimersByTime(500));

    expect(saveWorkspace).not.toHaveBeenCalled();
  });

  it("flushes the latest workspace before the page unloads", () => {
    const saveWorkspace = vi.fn();

    function Harness({ workspace }: { workspace: WorkspaceState }): null {
      useDebouncedWorkspaceSave({ loaded: true, workspace, saveWorkspace, delayMs: 250 });
      return null;
    }

    const latestWorkspace = { ...sampleWorkspace, gridColumns: 5 };
    const { rerender } = render(<Harness workspace={sampleWorkspace} />);

    rerender(<Harness workspace={latestWorkspace} />);
    window.dispatchEvent(new Event("pagehide"));

    expect(saveWorkspace).toHaveBeenCalledTimes(1);
    expect(saveWorkspace).toHaveBeenLastCalledWith(latestWorkspace);
  });
});
