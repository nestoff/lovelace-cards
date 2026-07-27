import type { HttpAuthRequest } from "../../shared/httpAuth";

export interface HttpAuthPromptState {
  request: HttpAuthRequest;
  tileId: string | null;
  cameraLabel: string;
  cameraType: string;
  username: string;
  password: string;
  save: boolean;
}

export function enqueueHttpAuthPrompt(
  queue: HttpAuthPromptState[],
  prompt: HttpAuthPromptState
): HttpAuthPromptState[] {
  return queue.some((item) => item.request.requestId === prompt.request.requestId)
    ? queue
    : [...queue, prompt];
}

export function updateCurrentHttpAuthPrompt(
  queue: HttpAuthPromptState[],
  patch: Partial<Pick<HttpAuthPromptState, "username" | "password" | "save">>
): HttpAuthPromptState[] {
  return queue.length === 0 ? queue : [{ ...queue[0], ...patch }, ...queue.slice(1)];
}

export function shiftHttpAuthPrompt(queue: HttpAuthPromptState[]): HttpAuthPromptState[] {
  return queue.slice(1);
}

export function removeHttpAuthPrompts(
  queue: HttpAuthPromptState[],
  predicate: (prompt: HttpAuthPromptState) => boolean
): { kept: HttpAuthPromptState[]; removed: HttpAuthPromptState[] } {
  return {
    kept: queue.filter((prompt) => !predicate(prompt)),
    removed: queue.filter(predicate)
  };
}

export class OneShotManualAuthGate {
  private readonly tileIds = new Set<string>();

  mark(tileIds: string[]): void {
    tileIds.forEach((tileId) => this.tileIds.add(tileId));
  }

  consume(tileId: string): boolean {
    if (!this.tileIds.has(tileId)) {
      return false;
    }

    this.tileIds.delete(tileId);
    return true;
  }

  clear(tileIds?: string[]): void {
    if (!tileIds) {
      this.tileIds.clear();
      return;
    }

    tileIds.forEach((tileId) => this.tileIds.delete(tileId));
  }
}
