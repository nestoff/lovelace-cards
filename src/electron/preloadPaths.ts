import path from "node:path";

export function getMainPreloadPath(electronDirname: string): string {
  return path.join(electronDirname, "preload.cjs");
}

export function getWebviewPreloadPath(electronDirname: string): string {
  return path.join(electronDirname, "webviewPreload.cjs");
}
