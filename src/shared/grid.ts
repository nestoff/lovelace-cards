export interface GridSlot {
  index: number;
  row: number;
  column: number;
  tileId: string | null;
}

export function buildGridSlots(tileIds: string[], columns: number): GridSlot[] {
  if (columns < 1) {
    throw new Error("Column count must be at least 1");
  }

  const rowCount = Math.max(1, Math.ceil(tileIds.length / columns));
  const slotCount = rowCount * columns;

  return Array.from({ length: slotCount }, (_, index) => ({
    index,
    row: Math.floor(index / columns),
    column: index % columns,
    tileId: tileIds[index] ?? null
  }));
}
