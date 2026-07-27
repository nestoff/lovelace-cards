import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostPingIndicator } from "./HostPingIndicator";

describe("HostPingIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a green latency result", () => {
    render(
      <HostPingIndicator
        status={{
          state: "online",
          host: "10.20.100.101",
          reachable: true,
          latencyMs: 4.27,
          checkedAt: 100
        }}
      />
    );

    const indicator = screen.getByLabelText("Ping 10.20.100.101: 4.3 milliseconds");
    expect(indicator).toHaveClass("online");
    expect(screen.getByText("4.3 ms")).toBeVisible();

    fireEvent.focus(indicator);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Camera reachable");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "One 16-byte ping packet is sent every 5 seconds."
    );
  });

  it("formats sub-millisecond and slower replies compactly", () => {
    const { rerender } = render(
      <HostPingIndicator
        status={{
          state: "online",
          host: "127.0.0.1",
          reachable: true,
          latencyMs: 0.5,
          checkedAt: 100
        }}
      />
    );
    expect(screen.getByText("<1 ms")).toBeVisible();

    rerender(
      <HostPingIndicator
        status={{
          state: "online",
          host: "10.20.100.108",
          reachable: true,
          latencyMs: 18.7,
          checkedAt: 100
        }}
      />
    );
    expect(screen.getByText("19 ms")).toBeVisible();
  });

  it("shows a red offline state", () => {
    render(
      <HostPingIndicator
        status={{
          state: "offline",
          host: "10.20.100.105",
          reachable: false,
          latencyMs: null,
          checkedAt: 100,
          offlineSince: 100
        }}
      />
    );

    expect(screen.getByLabelText("Ping 10.20.100.105: offline")).toHaveClass("offline");
    expect(screen.getByText("Offline")).toBeVisible();
  });

  it("offers reload only after ten continuous offline seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const onReload = vi.fn();
    render(
      <HostPingIndicator
        status={{
          state: "offline",
          host: "10.20.100.105",
          reachable: false,
          latencyMs: null,
          checkedAt: 1_000,
          offlineSince: 1_000
        }}
        onReload={onReload}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Reload camera at 10.20.100.105" })
    ).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(9_999));
    expect(
      screen.queryByRole("button", { name: "Reload camera at 10.20.100.105" })
    ).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    const reload = screen.getByRole("button", {
      name: "Reload camera at 10.20.100.105"
    });
    fireEvent.click(reload);
    expect(onReload).toHaveBeenCalledOnce();

    fireEvent.pointerEnter(reload);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("removes the reload action when the camera recovers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const onReload = vi.fn();
    const { rerender } = render(
      <HostPingIndicator
        status={{
          state: "offline",
          host: "10.20.100.105",
          reachable: false,
          latencyMs: null,
          checkedAt: 20_000,
          offlineSince: 1_000
        }}
        onReload={onReload}
      />
    );

    expect(
      screen.getByRole("button", { name: "Reload camera at 10.20.100.105" })
    ).toBeVisible();

    rerender(
      <HostPingIndicator
        status={{
          state: "online",
          host: "10.20.100.105",
          reachable: true,
          latencyMs: 4,
          checkedAt: 20_100
        }}
        onReload={onReload}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Reload camera at 10.20.100.105" })
    ).not.toBeInTheDocument();
  });

  it("describes the configured ping interval", () => {
    render(
      <HostPingIndicator
        pingIntervalSeconds={12}
        status={{ state: "checking", host: "10.20.100.102" }}
      />
    );

    fireEvent.focus(screen.getByLabelText("Ping 10.20.100.102: checking"));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "One 16-byte ping packet is sent every 12 seconds."
    );
  });

  it("shows a neutral state while the first packet is in flight", () => {
    render(
      <HostPingIndicator status={{ state: "checking", host: "10.20.100.102" }} />
    );

    expect(screen.getByLabelText("Ping 10.20.100.102: checking")).toHaveClass(
      "checking"
    );
    expect(screen.getByText("Checking")).toBeVisible();
  });
});
