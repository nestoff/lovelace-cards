/**
 * Probel SW-P-08 (SW-P-88) framing + message helpers.
 *
 * Numbers in this module are protocol/zero-based unless noted as "ui"
 * (1-based, matching Companion / SKAARHOJ UI).
 *
 * Spec references: Grass Valley SW-P-08 Issue 32 / Companion generic-swp08.
 */

export const SWP08_DLE = 0x10;
export const SWP08_STX = 0x02;
export const SWP08_ETX = 0x03;
export const SWP08_ACK = 0x06;
export const SWP08_NAK = 0x15;

export const SWP08_DEFAULT_PORT = 8910;

/** Command bytes we implement as a router. */
export const Swp08Command = {
  protocolImplementation: 0x61,
  protocolImplementationResponse: 0x62,
  crosspointInterrogate: 0x01,
  crosspointConnect: 0x02,
  crosspointTally: 0x03,
  crosspointConnected: 0x04,
  crosspointTallyDump: 0x15,
  crosspointTallyDumpByteResponse: 0x16,
  crosspointTallyDumpWordResponse: 0x17,
  getSourceNames: 0x64,
  getDestNames: 0x66,
  sourceNamesResponse: 0x6a,
  destNamesResponse: 0x6b,
  extendedInterrogate: 0x81,
  extendedCrosspointConnect: 0x82,
  extendedCrosspointTally: 0x83,
  extendedCrosspointConnected: 0x84,
  extendedCrosspointTallyDump: 0x95,
  extendedCrosspointTallyDumpWordResponse: 0x97,
  extendedGetSourceNames: 0xe4,
  extendedGetDestNames: 0xe6,
  extendedSourceNamesResponse: 0xea,
  extendedDestNamesResponse: 0xeb
} as const;

export type Swp08CommandCode = (typeof Swp08Command)[keyof typeof Swp08Command];

export const SWP08_SUPPORTED_COMMANDS: number[] = [
  Swp08Command.protocolImplementation,
  Swp08Command.protocolImplementationResponse,
  Swp08Command.crosspointInterrogate,
  Swp08Command.crosspointConnect,
  Swp08Command.crosspointTally,
  Swp08Command.crosspointConnected,
  Swp08Command.crosspointTallyDump,
  Swp08Command.crosspointTallyDumpWordResponse,
  Swp08Command.getSourceNames,
  Swp08Command.getDestNames,
  Swp08Command.sourceNamesResponse,
  Swp08Command.destNamesResponse,
  Swp08Command.extendedInterrogate,
  Swp08Command.extendedCrosspointConnect,
  Swp08Command.extendedCrosspointTally,
  Swp08Command.extendedCrosspointConnected,
  Swp08Command.extendedCrosspointTallyDump,
  Swp08Command.extendedCrosspointTallyDumpWordResponse,
  Swp08Command.extendedGetSourceNames,
  Swp08Command.extendedGetDestNames,
  Swp08Command.extendedSourceNamesResponse,
  Swp08Command.extendedDestNamesResponse
];

export const ACK_FRAME = Buffer.from([SWP08_DLE, SWP08_ACK]);
export const NAK_FRAME = Buffer.from([SWP08_DLE, SWP08_NAK]);

const CHAR_LENGTHS = [4, 8, 12, 16, 32] as const;

export function uiToProtocol(value: number): number {
  return value - 1;
}

export function protocolToUi(value: number): number {
  return value + 1;
}

export function twosComplementChecksum(bytes: number[]): number {
  let sum = 0;
  for (const value of bytes) {
    sum += value;
  }
  return (~sum + 1) & 0xff;
}

export function stuffDle(bytes: number[]): number[] {
  const out: number[] = [];
  for (const value of bytes) {
    out.push(value);
    if (value === SWP08_DLE) {
      out.push(SWP08_DLE);
    }
  }
  return out;
}

export function unstuffDle(bytes: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    out.push(bytes[i]!);
    if (bytes[i] === SWP08_DLE && bytes[i + 1] === SWP08_DLE) {
      i += 1;
    }
  }
  return out;
}

/** Encode DATA (command + payload) into a full SOM…EOM frame. */
export function encodeMessage(data: number[]): Buffer {
  const length = data.length;
  const checksum = twosComplementChecksum([...data, length]);
  const body = stuffDle([...data, length, checksum]);
  return Buffer.from([SWP08_DLE, SWP08_STX, ...body, SWP08_DLE, SWP08_ETX]);
}

export type Swp08DecodedFrame =
  | { type: "ack" }
  | { type: "nak" }
  | { type: "message"; data: number[] }
  | { type: "need_more" }
  | { type: "bad"; consumed: number };

/**
 * Consume one frame from a TCP receive buffer.
 * Returns how many bytes were consumed and the decoded frame (if any).
 */
export function consumeFrame(buffer: Buffer): { consumed: number; frame: Swp08DecodedFrame } {
  if (buffer.length < 2) {
    return { consumed: 0, frame: { type: "need_more" } };
  }

  if (buffer[0] !== SWP08_DLE) {
    return { consumed: 1, frame: { type: "bad", consumed: 1 } };
  }

  if (buffer[1] === SWP08_ACK) {
    return { consumed: 2, frame: { type: "ack" } };
  }
  if (buffer[1] === SWP08_NAK) {
    return { consumed: 2, frame: { type: "nak" } };
  }
  if (buffer[1] !== SWP08_STX) {
    return { consumed: 1, frame: { type: "bad", consumed: 1 } };
  }

  // Find EOM (DLE ETX), respecting DLE stuffing inside the body.
  let i = 2;
  while (i < buffer.length - 1) {
    if (buffer[i] === SWP08_DLE && buffer[i + 1] === SWP08_ETX) {
      const stuffed = Array.from(buffer.subarray(2, i));
      const unstuffed = unstuffDle(stuffed);
      if (unstuffed.length < 2) {
        return { consumed: i + 2, frame: { type: "bad", consumed: i + 2 } };
      }
      const checksum = unstuffed[unstuffed.length - 1]!;
      const byteCount = unstuffed[unstuffed.length - 2]!;
      const data = unstuffed.slice(0, unstuffed.length - 2);
      if (data.length !== byteCount) {
        return { consumed: i + 2, frame: { type: "bad", consumed: i + 2 } };
      }
      if (twosComplementChecksum([...data, byteCount]) !== checksum) {
        return { consumed: i + 2, frame: { type: "bad", consumed: i + 2 } };
      }
      return { consumed: i + 2, frame: { type: "message", data } };
    }
    if (buffer[i] === SWP08_DLE && buffer[i + 1] === SWP08_DLE) {
      i += 2;
      continue;
    }
    i += 1;
  }

  return { consumed: 0, frame: { type: "need_more" } };
}

export function encodeMatrixLevel(matrix: number, level: number): number {
  return ((matrix & 0x0f) << 4) | (level & 0x0f);
}

export function decodeMatrixLevel(byte: number): { matrix: number; level: number } {
  return { matrix: (byte >> 4) & 0x0f, level: byte & 0x0f };
}

export function encodeMultiplier(source: number, dest: number): number {
  return ((dest >> 7) & 0x07) << 4 | ((source >> 7) & 0x07);
}

export function decodeStandardCrosspoint(data: number[]): {
  matrix: number;
  level: number;
  source: number;
  dest: number;
} | null {
  if (data.length < 5) {
    return null;
  }
  const { matrix, level } = decodeMatrixLevel(data[1]!);
  const multiplier = data[2]!;
  const dest = (((multiplier >> 4) & 0x07) << 7) | (data[3]! & 0x7f);
  const source = ((multiplier & 0x07) << 7) | (data[4]! & 0x7f);
  return { matrix, level, source, dest };
}

export function decodeExtendedCrosspoint(data: number[]): {
  matrix: number;
  level: number;
  source: number;
  dest: number;
} | null {
  if (data.length < 7) {
    return null;
  }
  return {
    matrix: data[1]!,
    level: data[2]!,
    dest: (data[3]! << 8) | data[4]!,
    source: (data[5]! << 8) | data[6]!
  };
}

export function encodeCrosspointConnected(
  matrix: number,
  level: number,
  source: number,
  dest: number,
  extended: boolean
): Buffer {
  if (extended) {
    return encodeMessage([
      Swp08Command.extendedCrosspointConnected,
      matrix & 0xff,
      level & 0xff,
      (dest >> 8) & 0xff,
      dest & 0xff,
      (source >> 8) & 0xff,
      source & 0xff
    ]);
  }
  return encodeMessage([
    Swp08Command.crosspointConnected,
    encodeMatrixLevel(matrix, level),
    encodeMultiplier(source, dest),
    dest & 0x7f,
    source & 0x7f
  ]);
}

export function encodeCrosspointTally(
  matrix: number,
  level: number,
  source: number,
  dest: number,
  extended: boolean
): Buffer {
  if (extended) {
    return encodeMessage([
      Swp08Command.extendedCrosspointTally,
      matrix & 0xff,
      level & 0xff,
      (dest >> 8) & 0xff,
      dest & 0xff,
      (source >> 8) & 0xff,
      source & 0xff
    ]);
  }
  return encodeMessage([
    Swp08Command.crosspointTally,
    encodeMatrixLevel(matrix, level),
    encodeMultiplier(source, dest),
    dest & 0x7f,
    source & 0x7f
  ]);
}

export function encodeTallyDumpWord(
  matrix: number,
  level: number,
  firstDest: number,
  sources: number[],
  extended: boolean
): Buffer {
  const chunk = sources.slice(0, 64);
  if (extended) {
    const data = [
      Swp08Command.extendedCrosspointTallyDumpWordResponse,
      matrix & 0xff,
      level & 0xff,
      chunk.length & 0xff,
      (firstDest >> 8) & 0xff,
      firstDest & 0xff
    ];
    for (const source of chunk) {
      data.push((source >> 8) & 0xff, source & 0xff);
    }
    return encodeMessage(data);
  }

  const data = [
    Swp08Command.crosspointTallyDumpWordResponse,
    encodeMatrixLevel(matrix, level),
    chunk.length & 0xff,
    (firstDest >> 8) & 0xff,
    firstDest & 0xff
  ];
  for (const source of chunk) {
    data.push((source >> 8) & 0xff, source & 0xff);
  }
  return encodeMessage(data);
}

export function encodeProtocolImplementationResponse(commands: number[]): Buffer {
  // Response: cmd, number of commands, then command bytes.
  return encodeMessage([
    Swp08Command.protocolImplementationResponse,
    commands.length & 0xff,
    ...commands.map((command) => command & 0xff)
  ]);
}

export function charLengthCode(chars: number): number {
  const index = CHAR_LENGTHS.indexOf(chars as (typeof CHAR_LENGTHS)[number]);
  return index >= 0 ? index : 1;
}

export function charsFromCode(code: number): number {
  return CHAR_LENGTHS[code] ?? 8;
}

function padLabel(label: string, chars: number): string {
  const trimmed = label.slice(0, chars);
  return trimmed.padEnd(chars, " ");
}

/**
 * Source/dest names response (standard 0x6A / 0x6B).
 * Simplified: one name starting at firstId, charLen from request.
 */
export function encodeNamesResponse(options: {
  responseCommand: number;
  matrix: number;
  level: number;
  firstId: number;
  charLength: number;
  names: string[];
  extended: boolean;
}): Buffer {
  const charLength = options.charLength;
  const names = options.names.slice(0, 16);
  if (options.extended) {
    const data = [
      options.responseCommand,
      options.matrix & 0xff,
      options.level & 0xff,
      charLengthCode(charLength),
      names.length & 0xff,
      (options.firstId >> 8) & 0xff,
      options.firstId & 0xff
    ];
    for (const name of names) {
      const padded = padLabel(name, charLength);
      for (let i = 0; i < charLength; i += 1) {
        data.push(padded.charCodeAt(i) & 0xff);
      }
    }
    return encodeMessage(data);
  }

  const data = [
    options.responseCommand,
    encodeMatrixLevel(options.matrix, options.level),
    charLengthCode(charLength),
    names.length & 0xff,
    options.firstId & 0xff
  ];
  for (const name of names) {
    const padded = padLabel(name, charLength);
    for (let i = 0; i < charLength; i += 1) {
      data.push(padded.charCodeAt(i) & 0xff);
    }
  }
  return encodeMessage(data);
}

export type Swp08ParsedRequest =
  | { kind: "protocol_implementation" }
  | {
      kind: "connect" | "interrogate";
      extended: boolean;
      matrix: number;
      level: number;
      source: number;
      dest: number;
    }
  | {
      kind: "tally_dump";
      extended: boolean;
      matrix: number;
      level: number;
    }
  | {
      kind: "source_names" | "dest_names";
      extended: boolean;
      matrix: number;
      level: number;
      charLength: number;
    }
  | { kind: "unsupported"; command: number };

export function parseRequest(data: number[]): Swp08ParsedRequest {
  const command = data[0];
  if (command === undefined) {
    return { kind: "unsupported", command: -1 };
  }

  switch (command) {
    case Swp08Command.protocolImplementation:
      return { kind: "protocol_implementation" };

    case Swp08Command.crosspointConnect: {
      const decoded = decodeStandardCrosspoint(data);
      if (!decoded) {
        return { kind: "unsupported", command };
      }
      return { kind: "connect", extended: false, ...decoded };
    }
    case Swp08Command.extendedCrosspointConnect: {
      const decoded = decodeExtendedCrosspoint(data);
      if (!decoded) {
        return { kind: "unsupported", command };
      }
      return { kind: "connect", extended: true, ...decoded };
    }
    case Swp08Command.crosspointInterrogate: {
      if (data.length < 4) {
        return { kind: "unsupported", command };
      }
      const { matrix, level } = decodeMatrixLevel(data[1]!);
      const multiplier = data[2]!;
      const dest = (((multiplier >> 4) & 0x07) << 7) | (data[3]! & 0x7f);
      return {
        kind: "interrogate",
        extended: false,
        matrix,
        level,
        source: 0,
        dest
      };
    }
    case Swp08Command.extendedInterrogate: {
      if (data.length < 5) {
        return { kind: "unsupported", command };
      }
      return {
        kind: "interrogate",
        extended: true,
        matrix: data[1]!,
        level: data[2]!,
        dest: (data[3]! << 8) | data[4]!,
        source: 0
      };
    }
    case Swp08Command.crosspointTallyDump:
      if (data.length < 2) {
        return { kind: "unsupported", command };
      }
      return {
        kind: "tally_dump",
        extended: false,
        ...decodeMatrixLevel(data[1]!)
      };
    case Swp08Command.extendedCrosspointTallyDump:
      if (data.length < 3) {
        return { kind: "unsupported", command };
      }
      return {
        kind: "tally_dump",
        extended: true,
        matrix: data[1]!,
        level: data[2]!
      };
    case Swp08Command.getSourceNames:
    case Swp08Command.getDestNames: {
      const charLength = charsFromCode(data[1] ?? 1);
      return {
        kind: command === Swp08Command.getSourceNames ? "source_names" : "dest_names",
        extended: false,
        matrix: 0,
        level: 0,
        charLength
      };
    }
    case Swp08Command.extendedGetSourceNames:
    case Swp08Command.extendedGetDestNames: {
      if (data.length < 4) {
        return { kind: "unsupported", command };
      }
      return {
        kind:
          command === Swp08Command.extendedGetSourceNames ? "source_names" : "dest_names",
        extended: true,
        matrix: data[1]!,
        level: data[2]!,
        charLength: charsFromCode(data[3]!)
      };
    }
    default:
      return { kind: "unsupported", command };
  }
}
