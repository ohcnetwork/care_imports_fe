import { buildHeaderMap, validateRow } from "@/internalTypes/common";
import type { ImportConfig, ProcessedRow } from "@/internalTypes/importConfig";

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export function parseCsvText(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim().replace(/^"(.*)"$/, "$1"));
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim().replace(/^"(.*)"$/, "$1"));
  return result;
}

/**
 * Trigger a browser download of a string as a CSV file.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

interface CsvParsingConfig<TRow> {
  requiredHeaders?: ImportConfig<TRow>["requiredHeaders"];
  headerMap?: ImportConfig<TRow>["headerMap"];
  schema?: ImportConfig<TRow>["schema"];
  parseRow?: ImportConfig<TRow>["parseRow"];
  validateRows?: ImportConfig<TRow>["validateRows"];
  getRowIdentifier?: ImportConfig<TRow>["getRowIdentifier"];
}

/**
 * Parse a CSV string into ProcessedRow[] using the same pipeline as ImportFlow.
 *
 * Runs: parseCsvText → buildHeaderMap → check required headers →
 *       parseRow per row → Zod validate → sync cross-row validation.
 *
 * Async validateRows is NOT run here — pass the result to ImportFlow
 * with processedRows and let it handle async validation via its
 * "validating" step.
 */
export function parseCsvToProcessedRows<TRow>(
  csvText: string,
  config: CsvParsingConfig<TRow>,
): ProcessedRow<TRow>[] {
  const {
    requiredHeaders,
    headerMap,
    schema,
    parseRow,
    validateRows,
    getRowIdentifier,
  } = config;

  if (!requiredHeaders || !headerMap || !schema || !parseRow) {
    return [];
  }

  const { headers, rows } = parseCsvText(csvText);
  if (headers.length === 0) return [];

  const headerIndices = buildHeaderMap(headers, headerMap);

  const missingHeaders = requiredHeaders.filter(
    (header) => headerIndices[header] === undefined,
  );

  if (missingHeaders.length > 0) {
    return [
      {
        rowIndex: 1,
        raw: [],
        errors: [`Missing required headers: ${missingHeaders.join(", ")}`],
        data: {} as TRow,
      },
    ];
  }

  const processed: ProcessedRow<TRow>[] = rows.map((row, index) => {
    const rowIndex = index + 2;
    const rawObject = parseRow(row, headerIndices);
    const validation = validateRow(schema, rawObject);

    if (!validation.success) {
      return {
        rowIndex,
        raw: row,
        errors: validation.errors,
        data: rawObject as TRow,
      };
    }

    return {
      rowIndex,
      raw: row,
      errors: [],
      data: validation.data as TRow,
    };
  });

  // Sync cross-row validation only
  if (validateRows && getRowIdentifier) {
    const validRows = processed.filter((p) => p.errors.length === 0);
    const validData = validRows.map((p) => p.data);
    const result = validateRows(validData);

    // Only apply if result is synchronous (not a Promise)
    if (!(result instanceof Promise)) {
      const identifierToRows = new Map<string, ProcessedRow<TRow>[]>();
      for (const p of processed) {
        const id = getRowIdentifier(p.data);
        const existing = identifierToRows.get(id) || [];
        existing.push(p);
        identifierToRows.set(id, existing);
      }

      for (const error of result) {
        const matchingRows = identifierToRows.get(error.identifier);
        if (matchingRows) {
          for (const row of matchingRows) {
            row.errors.push(error.reason);
          }
        }
      }
    }
  }

  return processed;
}
