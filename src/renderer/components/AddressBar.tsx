import type { ReactElement } from "react";
import { FormEvent, useEffect, useState } from "react";
import { CornerDownLeft, PanelTopOpen } from "lucide-react";
import { IconButton } from "./ui/IconButton";

interface AddressBarProps {
  value: string;
  onNavigate: (input: string, target: "selected" | "new") => void;
}

export function AddressBar({ value, onNavigate }: AddressBarProps): ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onNavigate(draft, "selected");
  }

  return (
    <form className="address-bar" onSubmit={submit}>
      <input
        aria-label="Address"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setDraft(value)}
      />
      <IconButton
        type="submit"
        label="Open address"
        tooltip={{
          title: "Open address",
          description: "Loads the typed address in the selected camera tile."
        }}
        icon={<CornerDownLeft size={16} strokeWidth={2.2} />}
      />
      <IconButton
        type="button"
        label="Open address in new tile"
        tooltip={{
          title: "Open in new tile",
          description: "Creates another tile and loads the typed address there."
        }}
        icon={<PanelTopOpen size={16} strokeWidth={2.2} />}
        onClick={() => onNavigate(draft, "new")}
      />
    </form>
  );
}
