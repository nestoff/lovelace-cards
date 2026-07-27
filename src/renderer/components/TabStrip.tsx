import type { ReactElement } from "react";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { TileState } from "../../shared/types";
import { IconButton } from "./ui/IconButton";

interface TabStripProps {
  tiles: TileState[];
  selectedTileId: string | null;
  onSelectTile: (tileId: string) => void;
  onAddTile: () => void;
  onCloseTile: (tileId: string) => void;
  onMoveTileToIndex: (tileId: string, toIndex: number) => void;
  auxiliaryTab?: AuxiliaryTab;
}

export interface AuxiliaryTab {
  id: string;
  title: string;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function TabStrip({
  tiles,
  selectedTileId,
  onSelectTile,
  onAddTile,
  onCloseTile,
  onMoveTileToIndex,
  auxiliaryTab
}: TabStripProps): ReactElement {
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);

  return (
    <div className="tab-strip" aria-label="Camera tabs">
      <div className="tab-list">
        {tiles.map((tile, index) => {
          const label = tile.title || tile.url || "Blank";
          const active = !auxiliaryTab?.active && tile.id === selectedTileId;
          return (
          <div
            key={tile.id}
            className={active ? "tab active" : "tab"}
            draggable
            aria-label={`Tab ${label}`}
            onDragStart={(event) => {
              setDraggedTileId(tile.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", tile.id);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const sourceTileId = draggedTileId || event.dataTransfer.getData("text/plain");
              if (sourceTileId && sourceTileId !== tile.id) {
                onMoveTileToIndex(sourceTileId, index);
              }
              setDraggedTileId(null);
            }}
            onDragEnd={() => setDraggedTileId(null)}
          >
            <button type="button" className="tab-select" onClick={() => onSelectTile(tile.id)}>
              <span className="tab-index">{index + 1}</span>
              <span className="tab-title">{label}</span>
            </button>
            <IconButton
              className="tab-close"
              label={`Close ${label}`}
              tooltip={{
                title: "Close camera",
                description: "Removes this camera tile from the open grid."
              }}
              icon={<X size={13} strokeWidth={2.3} />}
              onClick={() => onCloseTile(tile.id)}
            />
          </div>
          );
        })}
        {auxiliaryTab && (
          <div
            className={auxiliaryTab.active ? "tab help-tab active" : "tab help-tab"}
            aria-label={`Tab ${auxiliaryTab.title}`}
          >
            <button
              type="button"
              className="tab-select"
              aria-label={`Select ${auxiliaryTab.title}`}
              onClick={auxiliaryTab.onSelect}
            >
              <span className="tab-index" aria-hidden="true">
                ?
              </span>
              <span className="tab-title">{auxiliaryTab.title}</span>
            </button>
            <IconButton
              className="tab-close"
              label={`Close ${auxiliaryTab.title}`}
              tooltip={{
                title: `Close ${auxiliaryTab.title}`,
                description: "Returns to the selected camera without changing it."
              }}
              icon={<X size={13} strokeWidth={2.3} />}
              onClick={auxiliaryTab.onClose}
            />
          </div>
        )}
      </div>
      <IconButton
        label="Add tile"
        tooltip={{
          title: "Add tile",
          description: "Opens a new blank camera browser tile."
        }}
        icon={<Plus size={16} strokeWidth={2.3} />}
        className="add-tab-button"
        onClick={onAddTile}
      />
    </div>
  );
}
