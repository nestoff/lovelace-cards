interface ProcessWritableStream {
  on: (eventName: "error", listener: (error: Error & { code?: string }) => void) => unknown;
}

interface ProcessStreams {
  stdout?: ProcessWritableStream | null;
  stderr?: ProcessWritableStream | null;
}

function ignoreBrokenPipe(error: Error & { code?: string }): void {
  if (error.code === "EPIPE") {
    return;
  }

  throw error;
}

export function installProcessStreamGuards(processLike: ProcessStreams): void {
  processLike.stdout?.on("error", ignoreBrokenPipe);
  processLike.stderr?.on("error", ignoreBrokenPipe);
}
