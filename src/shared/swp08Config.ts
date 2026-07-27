import { SWP08_DEFAULT_PORT } from "./swp08.js";

export interface Swp08Config {
  /** When true, listen for Probel SW-P-08 clients (SKAARHOJ Blue Pill, etc.). */
  enabled: boolean;
  port: number;
  /**
   * MatrixID as typed in SKAARHOJ Configurable Model (protocol / 0-based, typically 0).
   */
  matrix: number;
  /** Number of levels advertised to the Blue Pill core settings. */
  levels: number;
  /** How many sources (cameras) to advertise. */
  sources: number;
  /** How many destinations to advertise (1 = Focus). */
  destinations: number;
  /**
   * Destination that focuses a camera when a source is routed to it (1-based,
   * matching Reactor destination numbering).
   */
  focusDestination: number;
}

export const DEFAULT_SWP08_CONFIG: Swp08Config = {
  enabled: false,
  port: SWP08_DEFAULT_PORT,
  matrix: 0,
  levels: 1,
  sources: 64,
  destinations: 1,
  focusDestination: 1
};

export function normalizeSwp08Port(port: unknown): number {
  const parsed = typeof port === "number" ? port : Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("SW-P-08 port must be an integer between 1 and 65535");
  }
  return parsed;
}

export function normalizePositiveInt(value: unknown, label: string, min = 1, max = 1024): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function normalizeMatrixId(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 15) {
    throw new Error("SW-P-08 MatrixID must be an integer between 0 and 15");
  }
  return parsed;
}

export function normalizeSwp08Config(raw: Partial<Swp08Config> | null | undefined): Swp08Config {
  const enabled = Boolean(raw?.enabled);
  const port = raw?.port === undefined ? DEFAULT_SWP08_CONFIG.port : normalizeSwp08Port(raw.port);
  const matrix =
    raw?.matrix === undefined ? DEFAULT_SWP08_CONFIG.matrix : normalizeMatrixId(raw.matrix);
  const levels =
    raw?.levels === undefined
      ? DEFAULT_SWP08_CONFIG.levels
      : normalizePositiveInt(raw.levels, "SW-P-08 levels", 1, 16);
  const sources =
    raw?.sources === undefined
      ? DEFAULT_SWP08_CONFIG.sources
      : normalizePositiveInt(raw.sources, "SW-P-08 sources", 1, 1024);
  const destinations =
    raw?.destinations === undefined
      ? DEFAULT_SWP08_CONFIG.destinations
      : normalizePositiveInt(raw.destinations, "SW-P-08 destinations", 1, 256);
  const focusDestination =
    raw?.focusDestination === undefined
      ? DEFAULT_SWP08_CONFIG.focusDestination
      : normalizePositiveInt(raw.focusDestination, "SW-P-08 focus destination", 1, destinations);

  return {
    enabled,
    port,
    matrix,
    levels,
    sources,
    destinations,
    focusDestination
  };
}

export interface Swp08Info {
  enabled: boolean;
  host: string;
  port: number;
  matrix: number;
  levels: number;
  sources: number;
  destinations: number;
  focusDestination: number;
  listening: boolean;
  clientCount: number;
  error?: string;
}
