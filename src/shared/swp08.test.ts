import { describe, expect, it } from "vitest";
import {
  ACK_FRAME,
  Swp08Command,
  consumeFrame,
  encodeCrosspointConnected,
  encodeMessage,
  parseRequest,
  protocolToUi,
  twosComplementChecksum,
  uiToProtocol
} from "./swp08";

describe("swp08 protocol", () => {
  it("converts UI 1-based ids to protocol 0-based", () => {
    expect(uiToProtocol(1)).toBe(0);
    expect(protocolToUi(0)).toBe(1);
  });

  it("round-trips a connect frame through consumeFrame", () => {
    const data = [
      Swp08Command.crosspointConnect,
      0x00, // matrix 0 level 0
      0x00, // multiplier
      0x00, // dest 0
      0x02 // source 2 → camera 3
    ];
    const frame = encodeMessage(data);
    const { consumed, frame: decoded } = consumeFrame(frame);
    expect(consumed).toBe(frame.length);
    expect(decoded).toEqual({ type: "message", data });
  });

  it("parses standard connect requests", () => {
    const parsed = parseRequest([
      Swp08Command.crosspointConnect,
      0x00,
      0x00,
      0x00,
      0x02
    ]);
    expect(parsed).toEqual({
      kind: "connect",
      extended: false,
      matrix: 0,
      level: 0,
      dest: 0,
      source: 2
    });
  });

  it("parses extended connect requests", () => {
    const parsed = parseRequest([
      Swp08Command.extendedCrosspointConnect,
      0,
      0,
      0,
      0,
      0,
      5
    ]);
    expect(parsed).toMatchObject({
      kind: "connect",
      extended: true,
      source: 5,
      dest: 0
    });
  });

  it("checksums with two's complement", () => {
    expect(twosComplementChecksum([2, 0, 0, 0, 2, 5])).toBe(
      (~(2 + 0 + 0 + 0 + 2 + 5) + 1) & 0xff
    );
  });

  it("detects ACK frames", () => {
    expect(consumeFrame(ACK_FRAME).frame).toEqual({ type: "ack" });
  });

  it("encodes connected replies that parse cleanly", () => {
    const reply = encodeCrosspointConnected(0, 0, 2, 0, false);
    const { frame } = consumeFrame(reply);
    expect(frame.type).toBe("message");
    if (frame.type === "message") {
      expect(frame.data[0]).toBe(Swp08Command.crosspointConnected);
      expect(parseRequest([
        Swp08Command.crosspointConnect,
        frame.data[1]!,
        frame.data[2]!,
        frame.data[3]!,
        frame.data[4]!
      ])).toMatchObject({ source: 2, dest: 0 });
    }
  });
});
