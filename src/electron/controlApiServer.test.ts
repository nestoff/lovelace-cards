import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import type {
  ControlApiCommand,
  ControlApiResponse,
  ControlApiStatus
} from "../shared/controlApi";
import { startControlApiServer } from "./controlApiServer";

const servers: Array<{ close: () => Promise<void> }> = [];

const emptyStatus: ControlApiStatus = {
  expansionEnabled: true,
  focusMode: false,
  selectedCameraNumber: 1,
  selectedTileId: "tile-41",
  selectedIndex: 1,
  tabs: []
};

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}

async function handshake(socket: WebSocket): Promise<Record<string, unknown>> {
  const response = nextMessage(socket);
  socket.send(
    JSON.stringify({
      type: "hello",
      protocol: "ditbrowse.control",
      protocolVersion: 1,
      client: { name: "test-client", version: "1.0.0" }
    })
  );
  return response;
}

async function startTestServer(
  dispatch = vi.fn(async (): Promise<ControlApiResponse> => ({ ok: true })),
  port: number | null = null
) {
  const server = await startControlApiServer({ dispatch, port });
  servers.push(server);
  return { server, dispatch };
}

describe("controlApiServer", () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("binds to 127.0.0.1 on an available port", async () => {
    const { server } = await startTestServer();

    expect(server.host).toBe("127.0.0.1");
    expect(server.port).toBeGreaterThan(0);
    expect(server.baseUrl).toBe(`http://127.0.0.1:${server.port}`);
  });

  it("can bind to all interfaces for Blue Pill LAN access", async () => {
    const server = await startControlApiServer({
      dispatch: vi.fn(async (): Promise<ControlApiResponse> => ({ ok: true })),
      port: null,
      host: "0.0.0.0"
    });
    servers.push(server);

    expect(server.host).toBe("0.0.0.0");
    expect(server.baseUrl).toBe(`http://0.0.0.0:${server.port}`);
  });

  it("can bind to a caller-selected free port", async () => {
    const reserved = await startTestServer();
    const port = reserved.server.port;
    await reserved.server.close();
    servers.splice(servers.indexOf(reserved.server), 1);

    const { server } = await startTestServer(undefined, port);

    expect(server.port).toBe(port);
  });

  it("rejects a caller-selected port that is already in use", async () => {
    const { server } = await startTestServer();

    await expect(startControlApiServer({ dispatch: vi.fn(), port: server.port })).rejects.toThrow();
  });

  it("dispatches status, focus, and grid commands", async () => {
    const dispatch = vi.fn(async (command: ControlApiCommand): Promise<ControlApiResponse> => ({
      ok: true,
      status: {
        expansionEnabled: true,
        focusMode: command.type === "focusTab" || command.type === "focusCamera",
        selectedCameraNumber:
          command.type === "focusTab" || command.type === "focusCamera" ? 2 : 1,
        selectedTileId:
          command.type === "focusTab" || command.type === "focusCamera" ? "tile-42" : "tile-41",
        selectedIndex: command.type === "focusTab" || command.type === "focusCamera" ? 2 : 1,
        tabs: []
      }
    }));
    const { server } = await startTestServer(dispatch);

    await expect(fetch(`${server.baseUrl}/api/status`)).resolves.toMatchObject({ status: 200 });
    await expect(fetch(`${server.baseUrl}/api/tabs/B/focus`, { method: "POST" })).resolves.toMatchObject({
      status: 200
    });
    await expect(fetch(`${server.baseUrl}/api/grid`, { method: "POST" })).resolves.toMatchObject({
      status: 200
    });

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "status" }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusTab", specifier: "B" })
    );
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "showGrid" }));
  });

  it("accepts browser-friendly GET camera focus and grid commands", async () => {
    const { server, dispatch } = await startTestServer();

    await expect(fetch(`${server.baseUrl}/api/focus/01`)).resolves.toMatchObject({
      status: 200
    });
    await expect(fetch(`${server.baseUrl}/api/focus/02`)).resolves.toMatchObject({
      status: 200
    });
    await expect(fetch(`${server.baseUrl}/api/grid`)).resolves.toMatchObject({ status: 200 });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusCamera", cameraNumber: 1 })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusCamera", cameraNumber: 2 })
    );
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "showGrid" }));
  });

  it("keeps the older tab-focused routes available for compatibility", async () => {
    const { server, dispatch } = await startTestServer();

    await expect(fetch(`${server.baseUrl}/api/tabs/B/focus`)).resolves.toMatchObject({
      status: 200
    });
    await expect(fetch(`${server.baseUrl}/api/focus?tab=B`)).resolves.toMatchObject({
      status: 200
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusTab", specifier: "B" })
    );
  });

  it("accepts focus commands from a JSON body", async () => {
    const { server, dispatch } = await startTestServer();

    const response = await fetch(`${server.baseUrl}/api/focus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tab: "tile-42" })
    });

    expect(response.status).toBe(200);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusTab", specifier: "tile-42" })
    );
  });

  it("returns route and renderer errors as JSON", async () => {
    const { server } = await startTestServer(async () => ({
      ok: false,
      error: "not_found",
      message: "Tab not found"
    }));

    await expect(fetch(`${server.baseUrl}/missing`)).resolves.toMatchObject({ status: 404 });

    const response = await fetch(`${server.baseUrl}/api/tabs/Z/focus`, { method: "POST" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "not_found",
      message: "Tab not found"
    });
  });

  it("handshakes and dispatches strict WebSocket commands", async () => {
    const dispatch = vi.fn(async (): Promise<ControlApiResponse> => ({
      ok: true,
      status: emptyStatus
    }));
    const { server } = await startTestServer(dispatch);
    const socket = await openSocket(`ws://${server.host}:${server.port}/api/ws`);

    await expect(handshake(socket)).resolves.toMatchObject({
      type: "hello",
      protocol: "ditbrowse.control",
      protocolVersion: 1
    });

    const result = nextMessage(socket);
    socket.send(
      JSON.stringify({
        type: "command",
        requestId: "focus-4",
        command: { type: "focusCamera", cameraNumber: 4 }
      })
    );

    await expect(result).resolves.toMatchObject({
      type: "result",
      requestId: "focus-4",
      ok: true
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusCamera", cameraNumber: 4 })
    );
  });

  it("rejects string camera numbers over WebSocket", async () => {
    const { server, dispatch } = await startTestServer();
    const socket = await openSocket(`ws://${server.host}:${server.port}/api/ws`);
    await handshake(socket);

    const result = nextMessage(socket);
    socket.send(
      JSON.stringify({
        type: "command",
        requestId: "bad-camera",
        command: { type: "focusCamera", cameraNumber: "04" }
      })
    );

    await expect(result).resolves.toMatchObject({
      type: "result",
      requestId: "bad-camera",
      ok: false,
      error: { code: "bad_request" }
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects and closes unsupported protocol versions", async () => {
    const { server } = await startTestServer();
    const socket = await openSocket(`ws://${server.host}:${server.port}/api/ws`);

    const result = nextMessage(socket);
    const closed = new Promise<number>((resolve) => {
      socket.once("close", (code) => resolve(code));
    });
    socket.send(
      JSON.stringify({
        type: "hello",
        protocol: "ditbrowse.control",
        protocolVersion: 2,
        client: { name: "future-client", version: "2.0.0" }
      })
    );

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "unsupported_protocol" }
    });
    await expect(closed).resolves.toBe(1002);
  });

  it("broadcasts revisioned status to handshaken clients", async () => {
    const { server } = await startTestServer();
    const socket = await openSocket(`ws://${server.host}:${server.port}/api/ws`);
    await handshake(socket);

    const event = nextMessage(socket);
    server.publishStatus(emptyStatus, 7);

    await expect(event).resolves.toEqual({
      type: "event",
      event: "status",
      revision: 7,
      status: emptyStatus
    });
    expect(server.clientCount).toBe(1);
  });

  it("closes active WebSocket clients with the server", async () => {
    const { server } = await startTestServer();
    const socket = await openSocket(`ws://${server.host}:${server.port}/api/ws`);
    await handshake(socket);

    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    await server.close();
    servers.splice(servers.indexOf(server), 1);

    await expect(closed).resolves.toBeUndefined();
  });
});
