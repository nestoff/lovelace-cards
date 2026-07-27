import http from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket, { WebSocketServer } from "ws";
import type {
  ControlApiCommand,
  ControlApiErrorCode,
  ControlApiResponse,
  ControlApiStatus
} from "../shared/controlApi.js";
import { parsePositiveCameraNumber } from "../shared/controlApi.js";
import {
  CONTROL_PROTOCOL,
  CONTROL_PROTOCOL_CAPABILITIES,
  CONTROL_PROTOCOL_VERSION,
  CONTROL_WEBSOCKET_PATH,
  isControlProtocolParseError,
  parseControlProtocolClientMessage,
  toControlApiCommand,
  toControlProtocolResult,
  type ControlProtocolError,
  type ControlProtocolServerHello,
  type ControlProtocolServerMessage,
  type ControlProtocolStatusEvent
} from "../shared/controlProtocol.js";

const DEFAULT_HOST = "127.0.0.1";

interface ControlApiServerOptions {
  dispatch: (command: ControlApiCommand) => Promise<ControlApiResponse>;
  port?: number | null;
  /** Listen address. Use 0.0.0.0 to allow Blue Pill / Skaarhoj on the LAN. */
  host?: string;
  appVersion?: string;
}

export interface ControlApiServer {
  host: string;
  port: number;
  baseUrl: string;
  readonly clientCount: number;
  publishStatus: (status: ControlApiStatus, revision: number) => void;
  close: () => Promise<void>;
}

interface ClientState {
  handshaken: boolean;
  alive: boolean;
  missedPongs: number;
}

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function responseStatus(response: ControlApiResponse): number {
  if (response.ok) {
    return 200;
  }

  const statuses: Record<ControlApiErrorCode, number> = {
    bad_request: 400,
    not_found: 404,
    renderer_unavailable: 503,
    timeout: 504,
    internal_error: 500
  };
  return statuses[response.error];
}

function writeJson(
  response: http.ServerResponse,
  status: number,
  body: Record<string, unknown> | ControlApiResponse
): void {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function badCameraNumber(message: string): ControlApiResponse {
  return { ok: false, error: "bad_request", message };
}

function cameraCommand(value: unknown): ControlApiCommand | ControlApiResponse {
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (typeof trimmed === "string" && !/^\d+$/.test(trimmed)) {
    return badCameraNumber("Camera number must be a positive integer");
  }

  const parsed = parsePositiveCameraNumber(
    typeof trimmed === "string" ? Number(trimmed) : trimmed
  );
  if (parsed === null) {
    return badCameraNumber("Camera number must be a positive integer");
  }

  return { requestId: requestId(), type: "focusCamera", cameraNumber: parsed };
}

function commandFromRoute(
  method: string | undefined,
  pathname: string,
  searchParams: URLSearchParams,
  body: unknown
): ControlApiCommand | ControlApiResponse {
  if (method === "GET" && pathname === "/api/status") {
    return { requestId: requestId(), type: "status" };
  }

  if ((method === "GET" || method === "POST") && pathname === "/api/grid") {
    return { requestId: requestId(), type: "showGrid" };
  }

  const focusMatch = /^\/api\/tabs\/([^/]+)\/focus$/.exec(pathname);
  if ((method === "GET" || method === "POST") && focusMatch) {
    return {
      requestId: requestId(),
      type: "focusTab",
      specifier: decodeURIComponent(focusMatch[1])
    };
  }

  const simpleFocusMatch = /^\/api\/focus\/([^/]+)$/.exec(pathname);
  if (method === "GET" && simpleFocusMatch) {
    return cameraCommand(decodeURIComponent(simpleFocusMatch[1]));
  }

  if (method === "GET" && pathname === "/api/focus") {
    if (searchParams.has("camera") || searchParams.has("cameraNumber")) {
      return cameraCommand(searchParams.get("camera") ?? searchParams.get("cameraNumber"));
    }

    const specifier = searchParams.get("tab") ?? "";
    if (!specifier.trim()) {
      return {
        ok: false,
        error: "bad_request",
        message: 'GET /api/focus requires a camera path like /api/focus/01'
      };
    }

    return { requestId: requestId(), type: "focusTab", specifier };
  }

  if (method === "POST" && pathname === "/api/focus") {
    if (
      body &&
      typeof body === "object" &&
      ("camera" in body || "cameraNumber" in body)
    ) {
      return cameraCommand("camera" in body ? body.camera : body.cameraNumber);
    }

    const specifier =
      body && typeof body === "object" && "tab" in body ? String(body.tab) : "";
    if (!specifier.trim()) {
      return {
        ok: false,
        error: "bad_request",
        message: 'POST /api/focus requires a JSON body like {"tab":"B"}'
      };
    }

    return { requestId: requestId(), type: "focusTab", specifier };
  }

  return {
    ok: false,
    error: "not_found",
    message: "Route not found"
  };
}

export async function startControlApiServer({
  dispatch,
  port = null,
  host = DEFAULT_HOST,
  appVersion = "0.1.0"
}: ControlApiServerOptions): Promise<ControlApiServer> {
  const listenHost = host.trim() || DEFAULT_HOST;
  const server = http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      writeJson(response, 204, {});
      return;
    }

    try {
      const url = new URL(request.url ?? "/", `http://${listenHost}`);
      const body = request.method === "POST" ? await readJsonBody(request) : null;
      const command = commandFromRoute(request.method, url.pathname, url.searchParams, body);
      if ("ok" in command) {
        writeJson(response, responseStatus(command), command);
        return;
      }

      const result = await dispatch(command);
      writeJson(response, responseStatus(result), result);
    } catch (error) {
      writeJson(response, 500, {
        ok: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : "Internal control API error"
      });
    }
  });

  const webSocketServer = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, ClientState>();
  let latestStatusEvent: ControlProtocolStatusEvent | null = null;
  let closed = false;

  const send = (socket: WebSocket, message: ControlProtocolServerMessage): void => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const protocolError = (
    socket: WebSocket,
    code: ControlProtocolError["error"]["code"],
    message: string
  ): void => {
    send(socket, { type: "error", error: { code, message } });
  };

  server.on("upgrade", (request, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(request.url ?? "/", `http://${listenHost}`).pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== CONTROL_WEBSOCKET_PATH) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  webSocketServer.on("connection", (socket) => {
    const state: ClientState = { handshaken: false, alive: true, missedPongs: 0 };
    clients.set(socket, state);

    socket.on("pong", () => {
      state.alive = true;
      state.missedPongs = 0;
    });

    socket.on("close", () => {
      clients.delete(socket);
    });

    socket.on("message", async (data) => {
      let rawMessage: unknown;
      try {
        rawMessage = JSON.parse(data.toString()) as unknown;
      } catch {
        protocolError(socket, "bad_request", "Message must contain valid JSON");
        return;
      }

      if (
        rawMessage &&
        typeof rawMessage === "object" &&
        "type" in rawMessage &&
        rawMessage.type === "hello" &&
        ("protocol" in rawMessage && rawMessage.protocol !== CONTROL_PROTOCOL ||
          "protocolVersion" in rawMessage &&
            rawMessage.protocolVersion !== CONTROL_PROTOCOL_VERSION)
      ) {
        protocolError(socket, "unsupported_protocol", "Unsupported DIT Browse control protocol");
        socket.close(1002, "Unsupported protocol");
        return;
      }

      const message = parseControlProtocolClientMessage(rawMessage);
      if (isControlProtocolParseError(message)) {
        if (message.requestId) {
          send(socket, {
            type: "result",
            requestId: message.requestId,
            ok: false,
            error: { code: message.error, message: message.message }
          });
        } else {
          protocolError(socket, "bad_request", message.message);
        }
        return;
      }

      if (message.type === "hello") {
        if (state.handshaken) {
          protocolError(socket, "bad_request", "Client has already completed the handshake");
          return;
        }

        state.handshaken = true;
        const hello: ControlProtocolServerHello = {
          type: "hello",
          protocol: CONTROL_PROTOCOL,
          protocolVersion: CONTROL_PROTOCOL_VERSION,
          server: { name: "DIT Browse", version: appVersion },
          capabilities: CONTROL_PROTOCOL_CAPABILITIES
        };
        send(socket, hello);
        if (latestStatusEvent) {
          send(socket, latestStatusEvent);
        }
        return;
      }

      if (!state.handshaken) {
        send(socket, {
          type: "result",
          requestId: message.requestId,
          ok: false,
          error: { code: "bad_request", message: "Complete the hello handshake first" }
        });
        return;
      }

      let result: ControlApiResponse;
      try {
        result = await dispatch(toControlApiCommand(message));
      } catch (error) {
        result = {
          ok: false,
          error: "internal_error",
          message: error instanceof Error ? error.message : "Internal control API error"
        };
      }
      send(socket, toControlProtocolResult(message.requestId, result));
    });
  });

  const healthTimer = setInterval(() => {
    for (const [socket, state] of clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (!state.alive) {
        state.missedPongs += 1;
        if (state.missedPongs >= 2) {
          socket.terminate();
          continue;
        }
      }

      state.alive = false;
      socket.ping();
    }
  }, 15_000);
  healthTimer.unref();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port ?? 0, listenHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address.port !== "number") {
    throw new Error("Control API server did not bind to a TCP port");
  }

  const api: ControlApiServer = {
    host: listenHost,
    port: address.port,
    baseUrl: `http://${listenHost}:${address.port}`,
    get clientCount() {
      return [...clients.keys()].filter((socket) => socket.readyState === WebSocket.OPEN).length;
    },
    publishStatus: (status, revision) => {
      latestStatusEvent = { type: "event", event: "status", revision, status };
      for (const [socket, state] of clients) {
        if (state.handshaken) {
          send(socket, latestStatusEvent);
        }
      }
    },
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(healthTimer);

      for (const socket of clients.keys()) {
        socket.terminate();
      }
      clients.clear();

      await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };

  return api;
}
