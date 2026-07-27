import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ControlApiCommand, ControlApiResponse } from "../shared/controlApi";
import {
  ACK_FRAME,
  Swp08Command,
  consumeFrame,
  encodeMessage
} from "../shared/swp08";
import { DEFAULT_SWP08_CONFIG } from "../shared/swp08Config";
import { buildTestConnectFrame, startSwp08Server, type Swp08Server } from "./swp08Server";

async function readUntil(
  socket: net.Socket,
  predicate: (buffer: Buffer) => boolean,
  timeoutMs = 2000
): Promise<Buffer> {
  let buffer = Buffer.alloc(0);
  return await new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for SW-P-08 data. Have: ${buffer.toString("hex")}`));
    }, timeoutMs);

    const onData = (chunk: Buffer): void => {
      buffer = Buffer.concat([buffer, chunk]);
      if (predicate(buffer)) {
        cleanup();
        resolve(buffer);
      }
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off("data", onData);
    };

    socket.on("data", onData);
  });
}

describe("swp08Server", () => {
  let server: Swp08Server | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it("ACKs and focuses a camera on crosspoint connect", async () => {
    const dispatch = vi.fn(async (command: ControlApiCommand): Promise<ControlApiResponse> => {
      expect(command).toMatchObject({ type: "focusCamera", cameraNumber: 3 });
      return { ok: true };
    });

    server = await startSwp08Server({
      config: { ...DEFAULT_SWP08_CONFIG, enabled: true, port: 0 },
      dispatch
    });

    const socket = net.createConnection({ host: "127.0.0.1", port: server.port });
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", reject);
    });

    // Protocol ids: matrix 0, dest 0 (focus), source 2 → UI camera 3
    socket.write(buildTestConnectFrame(0, 0, 2, 0, false));

    const received = await readUntil(socket, (buf) => buf.includes(ACK_FRAME) && buf.length > 4);
    expect(received.subarray(0, 2).equals(ACK_FRAME)).toBe(true);

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalled();
    });

    socket.end();
  });

  it("answers protocol implementation requests", async () => {
    server = await startSwp08Server({
      config: { ...DEFAULT_SWP08_CONFIG, enabled: true, port: 0 },
      dispatch: vi.fn(async () => ({ ok: true }))
    });

    const socket = net.createConnection({ host: "127.0.0.1", port: server.port });
    await new Promise<void>((resolve) => socket.once("connect", () => resolve()));

    socket.write(encodeMessage([Swp08Command.protocolImplementation]));
    const received = await readUntil(socket, (buf) => buf.length > 4);

    expect(received.subarray(0, 2).equals(ACK_FRAME)).toBe(true);
    const rest = received.subarray(2);
    const { frame } = consumeFrame(rest);
    expect(frame.type).toBe("message");
    if (frame.type === "message") {
      expect(frame.data[0]).toBe(Swp08Command.protocolImplementationResponse);
    }

    socket.end();
  });
});
