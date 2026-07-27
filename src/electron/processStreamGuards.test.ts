import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { installProcessStreamGuards } from "./processStreamGuards";

function makeStream(): EventEmitter & { on: EventEmitter["on"] } {
  return new EventEmitter();
}

function makeError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe("installProcessStreamGuards", () => {
  it("ignores broken stdout and stderr pipe errors", () => {
    const stdout = makeStream();
    const stderr = makeStream();

    installProcessStreamGuards({ stdout, stderr });

    expect(() => stdout.emit("error", makeError("EPIPE"))).not.toThrow();
    expect(() => stderr.emit("error", makeError("EPIPE"))).not.toThrow();
  });

  it("does not hide non-pipe stream errors", () => {
    const stdout = makeStream();
    const stderr = makeStream();

    installProcessStreamGuards({ stdout, stderr });

    expect(() => stderr.emit("error", makeError("EACCES"))).toThrow("EACCES");
  });
});
