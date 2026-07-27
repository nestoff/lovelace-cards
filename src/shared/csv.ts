import { defaultIndexForSuffix, normalizeCameraNumberSuffix } from "./cameraIndex.js";

export interface CameraCsvRow {
  rowNumber: number;
  name: string;
  url: string;
  suffix: string;
  cameraType: string;
  lens: string;
  displayNote: string;
  notes: string;
}

export interface CameraCsvError {
  rowNumber: number;
  message: string;
}

export interface CameraCsvParseResult {
  validRows: CameraCsvRow[];
  errors: CameraCsvError[];
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function readField(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    if (row[name]) {
      return row[name];
    }
  }
  return "";
}

export function parseCameraCsv(csvText: string): CameraCsvParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { validRows: [], errors: [{ rowNumber: 1, message: "CSV is empty" }] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  if (!headers.includes("url") && !headers.includes("suffix") && !headers.includes("number")) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, message: "CSV must include url, suffix, or number header" }]
    };
  }

  const validRows: CameraCsvRow[] = [];
  const errors: CameraCsvError[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const values = splitCsvLine(lines[lineIndex]);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const suffix = normalizeCameraNumberSuffix(
      readField(row, ["number", "camera #", "camera_number", "suffix"])
    );
    const url = readField(row, ["url", "full url", "full_url"]);
    const index = readField(row, ["index", "name"]);

    if (!url && !suffix) {
      errors.push({ rowNumber, message: "Row must include url or suffix" });
      continue;
    }

    validRows.push({
      rowNumber,
      name: index || defaultIndexForSuffix(suffix) || url,
      url,
      suffix,
      cameraType: readField(row, ["type", "camera type", "camera_type"]),
      lens: readField(row, ["lens"]),
      displayNote: readField(row, ["display note", "display_note", "note", "label"]),
      notes: readField(row, ["notes"])
    });
  }

  return { validRows, errors };
}
