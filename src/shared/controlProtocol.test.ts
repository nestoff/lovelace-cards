import { describe, expect, it } from "vitest";
import {
  parseControlProtocolClientMessage,
  toControlProtocolResult
} from "./controlProtocol";

describe("controlProtocol", () => {
  it("accepts the versioned hello message", () => {
    expect(
      parseControlProtocolClientMessage({
        type: "hello",
        protocol: "ditbrowse.control",
        protocolVersion: 1,
        client: { name: "companion-module-lightlab-ditbrowse", version: "0.1.0" }
      })
    ).toEqual({
      type: "hello",
      protocol: "ditbrowse.control",
      protocolVersion: 1,
      client: { name: "companion-module-lightlab-ditbrowse", version: "0.1.0" }
    });
  });

  it("accepts only positive integer camera commands", () => {
    expect(
      parseControlProtocolClientMessage({
        type: "command",
        requestId: "focus-4",
        command: { type: "focusCamera", cameraNumber: 4 }
      })
    ).toEqual({
      type: "command",
      requestId: "focus-4",
      command: { type: "focusCamera", cameraNumber: 4 }
    });

    for (const cameraNumber of ["4", "04", 0, -1, 1.5, null]) {
      expect(
        parseControlProtocolClientMessage({
          type: "command",
          requestId: "bad-camera",
          command: { type: "focusCamera", cameraNumber }
        })
      ).toMatchObject({ ok: false, error: "bad_request", requestId: "bad-camera" });
    }
  });

  it("rejects tab focus and commands without request ids", () => {
    expect(
      parseControlProtocolClientMessage({
        type: "command",
        requestId: "tab-1",
        command: { type: "focusTab", specifier: "A" }
      })
    ).toMatchObject({ ok: false, error: "bad_request", requestId: "tab-1" });

    expect(
      parseControlProtocolClientMessage({
        type: "command",
        command: { type: "status" }
      })
    ).toMatchObject({ ok: false, error: "bad_request" });
  });

  it("converts internal responses to protocol result envelopes", () => {
    expect(
      toControlProtocolResult("request-1", {
        ok: false,
        error: "not_found",
        message: "No camera number matches 25"
      })
    ).toEqual({
      type: "result",
      requestId: "request-1",
      ok: false,
      error: {
        code: "not_found",
        message: "No camera number matches 25"
      }
    });
  });
});
