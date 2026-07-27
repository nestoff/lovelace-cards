import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadWindowState, saveWindowState } from "./windowState";

const fallbackState = { width: 1440, height: 900 };

let userDataPath: string;

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "ditbrowse-window-state-"));
});

afterEach(async () => {
  await rm(userDataPath, { recursive: true, force: true });
});

function statePath(): string {
  return path.join(userDataPath, "window-state.json");
}

describe("window state", () => {
  it("uses the default size when no saved state exists", async () => {
    await expect(loadWindowState(userDataPath)).resolves.toEqual(fallbackState);
  });

  it.each(["", "not json", "null", "[]", '{"width":0,"height":900}'])(
    "uses the default size when saved state is empty, malformed, or invalid: %j",
    async (contents) => {
      await mkdir(userDataPath, { recursive: true });
      await writeFile(statePath(), contents, "utf8");

      await expect(loadWindowState(userDataPath)).resolves.toEqual(fallbackState);
    }
  );

  it("loads valid dimensions and screen coordinates", async () => {
    await writeFile(
      statePath(),
      JSON.stringify({ width: 1280, height: 720, x: -1280, y: 40 }),
      "utf8"
    );

    await expect(loadWindowState(userDataPath)).resolves.toEqual({
      width: 1280,
      height: 720,
      x: -1280,
      y: 40
    });
  });

  it("ignores incomplete coordinates while preserving valid dimensions", async () => {
    await writeFile(
      statePath(),
      JSON.stringify({ width: 1280, height: 720, x: 100 }),
      "utf8"
    );

    await expect(loadWindowState(userDataPath)).resolves.toEqual({
      width: 1280,
      height: 720
    });
  });

  it("atomically saves a state that can be loaded again", async () => {
    const state = { width: 1600, height: 1000, x: 20, y: 30 };

    await saveWindowState(userDataPath, state);

    await expect(loadWindowState(userDataPath)).resolves.toEqual(state);
    await expect(readFile(statePath(), "utf8")).resolves.toBe(
      `${JSON.stringify(state, null, 2)}\n`
    );
    await expect(readdir(userDataPath)).resolves.toEqual(["window-state.json"]);
  });
});
