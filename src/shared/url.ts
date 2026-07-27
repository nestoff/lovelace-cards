const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const SPECIAL_SCHEME_PATTERN = /^(about|data|file|mailto|javascript):/i;
const BARE_IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#].*)?$/;
const BARE_HOSTNAME_PATTERN = /^(?:localhost|(?:[a-z0-9-]+\.)+[a-z0-9-]+)(?::\d+)?(?:[/?#].*)?$/i;
const BARE_IPV4_PREFIX_PATTERN = /^(?:\d{1,3}\.){1,3}$/;
const HTTP_ORIGIN_PATTERN = /^(https?:\/\/[^/?#]+)(?=[/?#]|$)/i;
const STABLE_CAMERA_GUI_PATHS = new Set(["/rmt.html", "/index", "/index.htm", "/index.html"]);

function hasScheme(input: string): boolean {
  return ABSOLUTE_URL_PATTERN.test(input) || SPECIAL_SCHEME_PATTERN.test(input);
}

function looksLikeBareHost(input: string): boolean {
  return BARE_IPV4_PATTERN.test(input) || BARE_HOSTNAME_PATTERN.test(input);
}

function isLoginPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  return path === "/login" || path === "/login.html";
}

function isStableCameraGuiPath(pathname: string): boolean {
  return STABLE_CAMERA_GUI_PATHS.has(pathname.toLowerCase());
}

function httpOriginPreservingHostText(input: string): string | null {
  return input.match(HTTP_ORIGIN_PATTERN)?.[1] ?? null;
}

export function normalizeCameraUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || hasScheme(trimmed)) {
    return trimmed;
  }

  return looksLikeBareHost(trimmed) ? `http://${trimmed}` : trimmed;
}

export function normalizeCameraPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed || hasScheme(trimmed)) {
    return trimmed;
  }

  if (BARE_IPV4_PREFIX_PATTERN.test(trimmed) || looksLikeBareHost(trimmed)) {
    return `http://${trimmed}`;
  }

  return trimmed;
}

export function resolveCameraAddress(prefix: string, input: string): string {
  const trimmed = input.trim();
  const normalizedInput = normalizeCameraUrl(trimmed);
  if (normalizedInput !== trimmed || hasScheme(trimmed)) {
    return normalizedInput;
  }

  return `${normalizeCameraPrefix(prefix)}${trimmed}`;
}

export function stableCameraGuiPathFromUrl(input: string): string {
  const normalized = normalizeCameraUrl(input);

  try {
    const parsed = new URL(normalized);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      isStableCameraGuiPath(parsed.pathname)
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return "";
  }

  return "";
}

export function resolveCameraAddressWithStablePath(
  prefix: string,
  suffix: string,
  previousUrl: string
): string {
  const baseUrl = `${normalizeCameraPrefix(prefix)}${suffix}`;
  const stablePath = stableCameraGuiPathFromUrl(previousUrl);
  if (!stablePath) {
    return baseUrl;
  }

  const separator = baseUrl.endsWith("/") || stablePath.startsWith("/") ? "" : "/";
  return `${baseUrl}${separator}${stablePath}`;
}

export function cameraRootFromUrl(input: string): string {
  const normalized = normalizeCameraUrl(input);
  const origin = httpOriginPreservingHostText(normalized);

  try {
    const parsed = new URL(normalized);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && origin) {
      return origin;
    }
  } catch {
    return normalized;
  }

  return normalized;
}

export interface CameraBaseAddress {
  origin: string;
  baseUrl: string;
}

export function cameraBaseAddressFromUrl(input: string): CameraBaseAddress | null {
  const normalized = normalizeCameraUrl(input);

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const origin = httpOriginPreservingHostText(normalized) ?? parsed.origin;
    return { origin, baseUrl: `${origin}/` };
  } catch {
    return null;
  }
}

export function cameraBaseFromCommittedUrl(input: string): string {
  const normalized = normalizeCameraUrl(input);
  const origin = httpOriginPreservingHostText(normalized);

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
        return origin ?? parsed.origin;
      }

      if (isLoginPath(parsed.pathname)) {
        return origin ?? parsed.origin;
      }

      if (isStableCameraGuiPath(parsed.pathname)) {
        return `${origin ?? parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      return origin ?? parsed.origin;
    }
  } catch {
    return normalized;
  }

  return normalized;
}
