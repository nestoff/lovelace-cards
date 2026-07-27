import type {
  ControlApiCommand,
  ControlApiErrorCode,
  ControlApiResponse,
  ControlApiStatus
} from "./controlApi.js";

export const CONTROL_PROTOCOL = "ditbrowse.control";
export const CONTROL_PROTOCOL_VERSION = 1;
export const CONTROL_WEBSOCKET_PATH = "/api/ws";

export const CONTROL_PROTOCOL_CAPABILITIES = [
  "status",
  "focusCamera",
  "showGrid",
  "toggleExpansion",
  "statusEvents"
] as const;

export interface ControlProtocolClientHello {
  type: "hello";
  protocol: typeof CONTROL_PROTOCOL;
  protocolVersion: typeof CONTROL_PROTOCOL_VERSION;
  client: {
    name: string;
    version: string;
  };
}

export type ControlProtocolCommand =
  | { type: "status" }
  | { type: "focusCamera"; cameraNumber: number }
  | { type: "showGrid" }
  | { type: "toggleExpansion" };

export interface ControlProtocolCommandMessage {
  type: "command";
  requestId: string;
  command: ControlProtocolCommand;
}

export type ControlProtocolClientMessage =
  | ControlProtocolClientHello
  | ControlProtocolCommandMessage;

export interface ControlProtocolServerHello {
  type: "hello";
  protocol: typeof CONTROL_PROTOCOL;
  protocolVersion: typeof CONTROL_PROTOCOL_VERSION;
  server: {
    name: "DIT Browse";
    version: string;
  };
  capabilities: typeof CONTROL_PROTOCOL_CAPABILITIES;
}

export type ControlProtocolResult =
  | {
      type: "result";
      requestId: string;
      ok: true;
      status?: ControlApiStatus;
    }
  | {
      type: "result";
      requestId: string;
      ok: false;
      error: {
        code: ControlApiErrorCode;
        message: string;
      };
    };

export interface ControlProtocolStatusEvent {
  type: "event";
  event: "status";
  revision: number;
  status: ControlApiStatus;
}

export interface ControlProtocolError {
  type: "error";
  error: {
    code: "bad_request" | "unsupported_protocol";
    message: string;
  };
}

export type ControlProtocolServerMessage =
  | ControlProtocolServerHello
  | ControlProtocolResult
  | ControlProtocolStatusEvent
  | ControlProtocolError;

export interface ControlProtocolParseError {
  ok: false;
  error: "bad_request";
  message: string;
  requestId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseError(message: string, requestId?: string): ControlProtocolParseError {
  return {
    ok: false,
    error: "bad_request",
    message,
    ...(requestId ? { requestId } : {})
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseCommand(
  command: Record<string, unknown>,
  requestId: string
): ControlProtocolCommandMessage | ControlProtocolParseError {
  if (command.type === "status" || command.type === "showGrid" || command.type === "toggleExpansion") {
    return {
      type: "command",
      requestId,
      command: { type: command.type }
    };
  }

  if (command.type === "focusCamera") {
    if (
      typeof command.cameraNumber !== "number" ||
      !Number.isSafeInteger(command.cameraNumber) ||
      command.cameraNumber < 1
    ) {
      return parseError("cameraNumber must be a positive integer", requestId);
    }

    return {
      type: "command",
      requestId,
      command: { type: "focusCamera", cameraNumber: command.cameraNumber }
    };
  }

  return parseError("Unsupported control command", requestId);
}

export function parseControlProtocolClientMessage(
  value: unknown
): ControlProtocolClientMessage | ControlProtocolParseError {
  if (!isRecord(value)) {
    return parseError("Message must be a JSON object");
  }

  if (value.type === "hello") {
    if (
      value.protocol !== CONTROL_PROTOCOL ||
      value.protocolVersion !== CONTROL_PROTOCOL_VERSION ||
      !isRecord(value.client) ||
      !nonEmptyString(value.client.name) ||
      !nonEmptyString(value.client.version)
    ) {
      return parseError("Unsupported or invalid control protocol hello");
    }

    return {
      type: "hello",
      protocol: CONTROL_PROTOCOL,
      protocolVersion: CONTROL_PROTOCOL_VERSION,
      client: {
        name: value.client.name,
        version: value.client.version
      }
    };
  }

  if (value.type !== "command") {
    return parseError("Message type must be hello or command");
  }

  const requestId = nonEmptyString(value.requestId) ? value.requestId : undefined;
  if (!requestId) {
    return parseError("Command requestId must be a non-empty string");
  }
  if (!isRecord(value.command)) {
    return parseError("Command payload must be an object", requestId);
  }

  return parseCommand(value.command, requestId);
}

export function isControlProtocolParseError(
  value: ControlProtocolClientMessage | ControlProtocolParseError
): value is ControlProtocolParseError {
  return "ok" in value && value.ok === false;
}

export function toControlApiCommand(message: ControlProtocolCommandMessage): ControlApiCommand {
  return { ...message.command, requestId: message.requestId } as ControlApiCommand;
}

export function toControlProtocolResult(
  requestId: string,
  response: ControlApiResponse
): ControlProtocolResult {
  if (response.ok) {
    return {
      type: "result",
      requestId,
      ok: true,
      ...(response.status ? { status: response.status } : {})
    };
  }

  return {
    type: "result",
    requestId,
    ok: false,
    error: {
      code: response.error,
      message: response.message
    }
  };
}
