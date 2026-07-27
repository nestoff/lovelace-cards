import type { ReactElement } from "react";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

interface CompanionModuleSetupDialogProps {
  busy: boolean;
  error: string;
  onClose: () => void;
  onChoose: () => Promise<boolean>;
}

export function CompanionModuleSetupDialog({
  busy,
  error,
  onClose,
  onChoose
}: CompanionModuleSetupDialogProps): ReactElement {
  const chooseFolder = async (): Promise<void> => {
    if (await onChoose()) {
      onClose();
    }
  };

  return (
    <Dialog
      title="Set Up the Companion Module"
      description="DITBrowse could not find Companion's configured developer-module folder. Set it in Companion, then choose the same folder here."
      className="companion-setup-dialog"
      closeOnBackdrop={!busy}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void chooseFolder()}>
            {busy ? "Installing…" : "Choose Folder & Install"}
          </Button>
        </>
      }
    >
      <ol className="companion-setup-steps">
        <li>
          Open the Companion launcher and select <strong>Advanced Settings</strong>.
        </li>
        <li>
          Select <strong>Developer</strong>.
        </li>
        <li>
          Turn on <strong>Enable Developer Modules</strong>.
        </li>
        <li>
          Set <strong>Developer Modules Path</strong> to a folder Companion can watch.
        </li>
        <li>Return here and choose that same folder.</li>
      </ol>
      <p className="companion-setup-note">
        DITBrowse stores only the folder you choose. It does not change Companion&apos;s
        settings and will not install anything until you press the button below.
      </p>
      {error && (
        <p className="companion-setup-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
