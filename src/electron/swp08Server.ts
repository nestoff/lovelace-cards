import net from "node:net";
import type { ControlApiCommand, ControlApiResponse, ControlApiStatus } from "../shared/controlApi.js";
import {
  ACK_FRAME,
  NAK_FRAME,
  SWP08_SUPPORTED_COMMANDS,
  Swp08Command,
  consumeFrame,
  encodeCrosspointConnected,
  encodeCrosspointTally,
  encodeMessage,
  encodeNamesResponse,
  encodeProtocolImplementationResponse,
  encodeTallyDumpWord,
  parseRequest,
  protocolToUi,
  uiToProtocol
} from "../shared/swp08.js";
import type { Swp08Config } from "../shared/swp08Config.js";

export interface Swp08ServerOptions {
  config: Swp08Config;
  /** Prefer a LAN IPv4 for display; server always binds 0.0.0.0 when enabled. */
  advertisedHost?: string;
  dispatch: (command: ControlApiCommand) => Promise<ControlApiResponse>;
}

export interface Swp08Server {
  readonly config: Swp08Config;
  readonly host: string;
  readonly port: number;
  readonly clientCount: number;
  /** Update crosspoint state from DIT Browse UI / Local API status. */
  syncFromStatus: (status: ControlApiStatus) => void;
  /** Replace source labels (camera titles). Index 0 unused; camera N at index N. */
  setSourceLabels: (labels: Map<number, string>) => void;
  close: () => Promise<void>;
}

function requestId(): string {
  return `swp08-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * In-memory router: one matrix, one level, destinations[dest] = source (protocol ids).
 * Source 0 = disconnected / no camera.
 */
class RouterState {
  /** dest (protocol) → source (protocol) */
  private routes = new Map<number, number>();
  sourceLabels = new Map<number, string>();
  destLabels = new Map<number, string>();

  constructor(private readonly config: Swp08Config) {
    this.destLabels.set(uiToProtocol(config.focusDestination), "FOCUS");
    for (let i = 0; i < config.destinations; i += 1) {
      if (!this.destLabels.has(i)) {
        this.destLabels.set(i, `DST ${protocolToUi(i)}`);
      }
    }
  }

  getSource(dest: number): number {
    return this.routes.get(dest) ?? 0;
  }

  setRoute(dest: number, source: number): void {
    this.routes.set(dest, source);
  }

  allSourcesForLevel(): number[] {
    const sources: number[] = [];
    for (let dest = 0; dest < this.config.destinations; dest += 1) {
      sources.push(this.getSource(dest));
    }
    return sources;
  }

  labelForSource(source: number, chars: number): string {
    const ui = protocolToUi(source);
    const named = this.sourceLabels.get(ui);
    const raw = named?.trim() || `CAM ${ui}`;
    return raw.slice(0, chars);
  }

  labelForDest(dest: number, chars: number): string {
    const raw = this.destLabels.get(dest) ?? `DST ${protocolToUi(dest)}`;
    return raw.slice(0, chars);
  }
}

export async function startSwp08Server(options: Swp08ServerOptions): Promise<Swp08Server> {
  const config = options.config;
  if (!config.enabled) {
    throw new Error("SW-P-08 server is disabled");
  }

  const matrix = uiToProtocol(config.matrix);
  const level = 0;
  const focusDest = uiToProtocol(config.focusDestination);
  const state = new RouterState(config);
  const clients = new Set<net.Socket>();
  const buffers = new WeakMap<net.Socket, Buffer>();

  const broadcast = (frame: Buffer): void => {
    for (const client of clients) {
      if (!client.destroyed) {
        client.write(frame);
      }
    }
  };

  const handleConnect = async (
    socket: net.Socket,
    request: {
      extended: boolean;
      matrix: number;
      level: number;
      source: number;
      dest: number;
    }
  ): Promise<void> => {
    if (request.matrix !== matrix) {
      // ACK already sent; ignore foreign matrix.
      return;
    }

    const source = Math.max(0, Math.min(request.source, config.sources - 1));
    const dest = Math.max(0, Math.min(request.dest, config.destinations - 1));
    state.setRoute(dest, source);

    socket.write(
      encodeCrosspointConnected(matrix, level, source, dest, request.extended)
    );

    if (dest === focusDest && source >= 0) {
      const cameraNumber = protocolToUi(source);
      if (cameraNumber >= 1) {
        await options.dispatch({
          requestId: requestId(),
          type: "focusCamera",
          cameraNumber
        });
      }
    }
  };

  const replyTo = (socket: net.Socket, data: number[]): void => {
    const request = parseRequest(data);

    // Always ACK first for well-formed messages (caller already validated checksum).
    socket.write(ACK_FRAME);

    switch (request.kind) {
      case "protocol_implementation":
        socket.write(encodeProtocolImplementationResponse(SWP08_SUPPORTED_COMMANDS));
        return;

      case "connect":
        void handleConnect(socket, request).catch(() => {
          // Focus dispatch failures are non-fatal for the TCP session.
        });
        return;

      case "interrogate": {
        if (request.matrix !== matrix) {
          return;
        }
        const source = state.getSource(request.dest);
        socket.write(
          encodeCrosspointTally(matrix, level, source, request.dest, request.extended)
        );
        return;
      }

      case "tally_dump": {
        if (request.matrix !== matrix) {
          return;
        }
        const sources = state.allSourcesForLevel();
        socket.write(encodeTallyDumpWord(matrix, level, 0, sources, request.extended));
        return;
      }

      case "source_names": {
        const names: string[] = [];
        for (let i = 0; i < Math.min(config.sources, 16); i += 1) {
          names.push(state.labelForSource(i, request.charLength));
        }
        socket.write(
          encodeNamesResponse({
            responseCommand: request.extended
              ? Swp08Command.extendedSourceNamesResponse
              : Swp08Command.sourceNamesResponse,
            matrix,
            level,
            firstId: 0,
            charLength: request.charLength,
            names,
            extended: request.extended
          })
        );
        return;
      }

      case "dest_names": {
        const names: string[] = [];
        for (let i = 0; i < Math.min(config.destinations, 16); i += 1) {
          names.push(state.labelForDest(i, request.charLength));
        }
        socket.write(
          encodeNamesResponse({
            responseCommand: request.extended
              ? Swp08Command.extendedDestNamesResponse
              : Swp08Command.destNamesResponse,
            matrix,
            level,
            firstId: 0,
            charLength: request.charLength,
            names,
            extended: request.extended
          })
        );
        return;
      }

      case "unsupported":
        // Already ACKed; no further payload for unknown commands.
        return;
    }
  };

  const onData = (socket: net.Socket, chunk: Buffer): void => {
    const previous = buffers.get(socket) ?? Buffer.alloc(0);
    let buffer = Buffer.concat([previous, chunk]);

    while (buffer.length > 0) {
      const { consumed, frame } = consumeFrame(buffer);
      if (frame.type === "need_more") {
        break;
      }
      if (consumed <= 0) {
        break;
      }
      buffer = buffer.subarray(consumed);

      if (frame.type === "ack" || frame.type === "nak") {
        continue;
      }
      if (frame.type === "bad") {
        socket.write(NAK_FRAME);
        continue;
      }
      replyTo(socket, frame.data);
    }

    buffers.set(socket, buffer);
  };

  const server = net.createServer((socket) => {
    clients.add(socket);
    buffers.set(socket, Buffer.alloc(0));
    socket.on("data", (chunk) => onData(socket, chunk));
    socket.on("close", () => {
      clients.delete(socket);
    });
    socket.on("error", () => {
      clients.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;

  return {
    config,
    host: options.advertisedHost ?? "0.0.0.0",
    port,
    get clientCount() {
      return clients.size;
    },
    syncFromStatus(status: ControlApiStatus) {
      const camera = status.selectedCameraNumber;
      if (camera !== null && camera >= 1) {
        const source = uiToProtocol(camera);
        if (source >= 0 && source < config.sources) {
          const previous = state.getSource(focusDest);
          state.setRoute(focusDest, source);
          if (previous !== source) {
            broadcast(encodeCrosspointConnected(matrix, level, source, focusDest, false));
            broadcast(encodeCrosspointConnected(matrix, level, source, focusDest, true));
          }
        }
      }

      const labels = new Map<number, string>();
      for (const tab of status.tabs) {
        if (tab.cameraNumber !== null) {
          labels.set(tab.cameraNumber, tab.title || `CAM ${tab.cameraNumber}`);
        }
      }
      state.sourceLabels = labels;
    },
    setSourceLabels(labels: Map<number, string>) {
      state.sourceLabels = labels;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const client of clients) {
          client.destroy();
        }
        clients.clear();
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

/** Test helper: build a standard connect frame (protocol ids). */
export function buildTestConnectFrame(
  matrix: number,
  level: number,
  source: number,
  dest: number,
  extended = false
): Buffer {
  if (extended) {
    return encodeMessage([
      Swp08Command.extendedCrosspointConnect,
      matrix & 0xff,
      level & 0xff,
      (dest >> 8) & 0xff,
      dest & 0xff,
      (source >> 8) & 0xff,
      source & 0xff
    ]);
  }
  const multiplier = ((dest >> 7) & 0x07) << 4 | ((source >> 7) & 0x07);
  return encodeMessage([
    Swp08Command.crosspointConnect,
    ((matrix & 0x0f) << 4) | (level & 0x0f),
    multiplier,
    dest & 0x7f,
    source & 0x7f
  ]);
}
