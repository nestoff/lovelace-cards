import { ipcRenderer } from "electron";
import type { CredentialFill } from "../shared/credentials.js";

let temporaryViewZoomed = false;

function inputValue(element: Element | null): string {
  return element instanceof HTMLInputElement ? element.value.trim() : "";
}

function dispatchInputEvents(input: HTMLInputElement): void {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function isResetShortcut(event: KeyboardEvent): boolean {
  return (
    event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.key.toLowerCase() === "z" &&
    !isEditableTarget(event.target)
  );
}

function findPasswordInput(root: ParentNode = document): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>('input[type="password"]');
}

function findUsernameInput(passwordInput: HTMLInputElement): HTMLInputElement | null {
  const form = passwordInput.form;
  const root: ParentNode = form ?? document;
  const candidates = Array.from(
    root.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input[type="search"], input:not([type])'
    )
  );
  return candidates.find((candidate) => candidate !== passwordInput && !candidate.disabled) ?? null;
}

function captureCredential(passwordInput: HTMLInputElement): void {
  const password = passwordInput.value;
  if (!password) {
    return;
  }

  const usernameInput = findUsernameInput(passwordInput);
  ipcRenderer.sendToHost("ditbrowse:credential-captured", {
    url: window.location.href,
    username: inputValue(usernameInput),
    password
  });
}

function fillCredential(credential: CredentialFill): void {
  const passwordInput = findPasswordInput();
  if (!passwordInput) {
    return;
  }

  const usernameInput = findUsernameInput(passwordInput);
  if (usernameInput && !usernameInput.value) {
    usernameInput.value = credential.username;
    dispatchInputEvents(usernameInput);
  }

  if (!passwordInput.value) {
    passwordInput.value = credential.password;
    dispatchInputEvents(passwordInput);
  }
}

document.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      ipcRenderer.sendToHost("ditbrowse:temporary-view-gesture", {
        type: "pinch",
        deltaY: event.deltaY
      });
      return;
    }

    if (temporaryViewZoomed) {
      event.preventDefault();
      ipcRenderer.sendToHost("ditbrowse:temporary-view-gesture", {
        type: "pan",
        deltaX: event.deltaX,
        deltaY: event.deltaY
      });
    }
  },
  { capture: true, passive: false }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (!isResetShortcut(event)) {
      return;
    }

    event.preventDefault();
    ipcRenderer.sendToHost("ditbrowse:temporary-view-gesture", {
      type: "reset"
    });
  },
  true
);

document.addEventListener(
  "pointerdown",
  () => {
    ipcRenderer.sendToHost("ditbrowse:tile-interacted");
  },
  true
);

document.addEventListener(
  "focusin",
  () => {
    ipcRenderer.sendToHost("ditbrowse:tile-interacted");
  },
  true
);

document.addEventListener(
  "submit",
  (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const passwordInput = form ? findPasswordInput(form) : findPasswordInput();
    if (passwordInput) {
      captureCredential(passwordInput);
    }
  },
  true
);

document.addEventListener(
  "change",
  (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === "password") {
      captureCredential(event.target);
    }
  },
  true
);

ipcRenderer.on("ditbrowse:credential-fill", (_event, credential: CredentialFill) => {
  fillCredential(credential);
});

ipcRenderer.on(
  "ditbrowse:temporary-view-state",
  (_event, state: { zoomed?: boolean } | null | undefined) => {
    temporaryViewZoomed = !!state?.zoomed;
  }
);
