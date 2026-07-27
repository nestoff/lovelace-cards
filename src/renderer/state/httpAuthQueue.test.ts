import { describe, expect, it } from "vitest";
import {
  OneShotManualAuthGate,
  enqueueHttpAuthPrompt,
  removeHttpAuthPrompts,
  shiftHttpAuthPrompt,
  updateCurrentHttpAuthPrompt,
  type HttpAuthPromptState
} from "./httpAuthQueue";

function prompt(requestId: string, tileId: string): HttpAuthPromptState {
  return {
    request: {
      requestId,
      url: `http://${tileId}/`,
      host: tileId,
      port: 80
    },
    tileId,
    cameraLabel: tileId,
    cameraType: "VENICE 2",
    username: "admin",
    password: "secret",
    save: true
  };
}

describe("HTTP auth queue", () => {
  it("queues challenges in arrival order and ignores duplicate request IDs", () => {
    const first = enqueueHttpAuthPrompt([], prompt("one", "camera-1"));
    const second = enqueueHttpAuthPrompt(first, prompt("two", "camera-2"));
    const duplicate = enqueueHttpAuthPrompt(second, prompt("one", "camera-1"));

    expect(duplicate.map((item) => item.request.requestId)).toEqual(["one", "two"]);
    expect(shiftHttpAuthPrompt(duplicate)[0].request.requestId).toBe("two");
  });

  it("updates only the visible prompt", () => {
    const queue = [prompt("one", "camera-1"), prompt("two", "camera-2")];

    const updated = updateCurrentHttpAuthPrompt(queue, {
      username: "operator",
      save: false
    });

    expect(updated[0]).toMatchObject({
      cameraType: "VENICE 2",
      username: "operator",
      save: false
    });
    expect(updated[1]).toEqual(queue[1]);
  });

  it("removes matching prompts and returns them for cancellation", () => {
    const queue = [prompt("one", "camera-1"), prompt("two", "camera-2")];

    const result = removeHttpAuthPrompts(queue, (item) => item.tileId === "camera-1");

    expect(result.kept.map((item) => item.request.requestId)).toEqual(["two"]);
    expect(result.removed.map((item) => item.request.requestId)).toEqual(["one"]);
  });
});

describe("OneShotManualAuthGate", () => {
  it("requires explicit authentication exactly once per marked tile", () => {
    const gate = new OneShotManualAuthGate();
    gate.mark(["tile-1", "tile-2"]);

    expect(gate.consume("tile-1")).toBe(true);
    expect(gate.consume("tile-1")).toBe(false);
    expect(gate.consume("tile-2")).toBe(true);
  });

  it("can clear selected markers or the entire gate", () => {
    const gate = new OneShotManualAuthGate();
    gate.mark(["tile-1", "tile-2"]);
    gate.clear(["tile-1"]);

    expect(gate.consume("tile-1")).toBe(false);
    expect(gate.consume("tile-2")).toBe(true);

    gate.mark(["tile-3"]);
    gate.clear();
    expect(gate.consume("tile-3")).toBe(false);
  });
});
