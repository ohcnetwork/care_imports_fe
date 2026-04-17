import { z } from "zod";
import { parseCsvText } from "@/Utils/csv";
import { parseComponentCsv } from "@/Utils/masterImport/observationDefinition";
import type { QualifiedRange } from "@/types/base/qualifiedRange/qualifiedRange";
import type { ProcessedRow, ReviewColumn } from "@/internalTypes/importConfig";
import type {
  ObservationDefinitionComponentCreateSpec,
  ObservationDefinitionCreateSpec,
} from "@/types/emr/observationDefinition/observationDefinition";
import {
  ObservationDefinitionStatus,
  QuestionType,
  OBSERVATION_DEFINITION_CATEGORY,
} from "@/types/emr/observationDefinition/observationDefinition";
import { SlugSchema, normalizeHeader } from "@/internalTypes/common";

// ─── Headers ───────────────────────────────────────────────────────
export const OBS_DEF_REQUIRED_HEADERS = [
  "title",
  "slug_value",
  "description",
  "category",
  "permitted_data_type",
  "code_system",
  "code_value",
  "code_display",
] as const;

export const OBS_DEF_OPTIONAL_HEADERS = [
  "status",
  "body_site_system",
  "body_site_code",
  "body_site_display",
  "method_system",
  "method_code",
  "method_display",
  "permitted_unit_system",
  "permitted_unit_code",
  "permitted_unit_display",
  "derived_from_uri",
  "qualified_ranges",
] as const;

export const OBS_DEF_ALL_HEADERS = [
  ...OBS_DEF_REQUIRED_HEADERS,
  ...OBS_DEF_OPTIONAL_HEADERS,
] as const;

// ─── Header Map (normalized → canonical) ───────────────────────────
export const OBS_DEF_HEADER_MAP: Record<string, string> =
  OBS_DEF_ALL_HEADERS.reduce(
    (acc, header) => {
      acc[normalizeHeader(header)] = header;
      return acc;
    },
    {} as Record<string, string>,
  );

// ─── Zod Schema ────────────────────────────────────────────────────
export const ObservationDefinitionRowSchema = z.object({
  // Required
  title: z.string().min(1, "Title is required"),
  slug_value: SlugSchema,
  description: z.string().min(1, "Description is required"),
  category: z.enum(OBSERVATION_DEFINITION_CATEGORY as [string, ...string[]], {
    errorMap: () => ({
      message: `Category must be one of: ${OBSERVATION_DEFINITION_CATEGORY.join(", ")}`,
    }),
  }),
  permitted_data_type: z.nativeEnum(QuestionType, {
    errorMap: () => ({
      message: `Permitted data type must be one of: ${Object.values(QuestionType).join(", ")}`,
    }),
  }),
  code_system: z.string().min(1, "Code system is required"),
  code_value: z.string().min(1, "Code value is required"),
  code_display: z.string().min(1, "Code display is required"),

  // Optional
  status: z
    .nativeEnum(ObservationDefinitionStatus)
    .optional()
    .default(ObservationDefinitionStatus.active),
  body_site_system: z.string().optional(),
  body_site_code: z.string().optional(),
  body_site_display: z.string().optional(),
  method_system: z.string().optional(),
  method_code: z.string().optional(),
  method_display: z.string().optional(),
  permitted_unit_system: z.string().optional(),
  permitted_unit_code: z.string().optional(),
  permitted_unit_display: z.string().optional(),
  derived_from_uri: z.string().optional(),
  qualified_ranges: z.string().optional(),

  // Populated post-parse from the components CSV — not a CSV column
  component: z
    .array(z.record(z.unknown()))
    .default([])
    .transform(
      (c) => c as unknown as ObservationDefinitionComponentCreateSpec[],
    ),
});

export type ObservationDefinitionRow = z.infer<
  typeof ObservationDefinitionRowSchema
>;

// ─── Row Parser ────────────────────────────────────────────────────
export function parseObservationDefinitionRowToRaw(
  row: string[],
  headerIndices: Record<string, number>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const header of OBS_DEF_ALL_HEADERS) {
    const idx = headerIndices[header];
    result[header] = idx !== undefined ? (row[idx]?.trim() ?? "") : "";
  }
  return result;
}

// ─── Additional Row Validation ─────────────────────────────────────
export function additionalRowValidation(
  row: ObservationDefinitionRow,
): string[] {
  const errors: string[] = [];

  // Code triplets: if any part provided, need code+display
  const checkCodeTriplet = (
    system: string | undefined,
    code: string | undefined,
    display: string | undefined,
    label: string,
  ) => {
    if (!code && !display) return; // all absent → fine
    if (!code) errors.push(`${label}: code is required when display is set`);
    if (!display) errors.push(`${label}: display is required when code is set`);
    if ((code || display) && !system)
      errors.push(`${label}: system is required when code or display is set`);
  };

  checkCodeTriplet(
    row.body_site_system,
    row.body_site_code,
    row.body_site_display,
    "body_site",
  );
  checkCodeTriplet(
    row.method_system,
    row.method_code,
    row.method_display,
    "method",
  );
  checkCodeTriplet(
    row.permitted_unit_system,
    row.permitted_unit_code,
    row.permitted_unit_display,
    "permitted_unit",
  );

  // Validate qualified_ranges JSON if present
  if (row.qualified_ranges) {
    try {
      const parsed = JSON.parse(row.qualified_ranges);
      if (!Array.isArray(parsed)) {
        errors.push("qualified_ranges must be a JSON array");
      }
    } catch {
      errors.push("qualified_ranges must be valid JSON");
    }
  }

  return errors;
}

// ─── Cross-Row Validation ──────────────────────────────────────────
export function validateObservationDefinitionRows(
  rows: ObservationDefinitionRow[],
): { identifier: string; reason: string }[] {
  const errors: { identifier: string; reason: string }[] = [];
  const slugSeen = new Map<string, number>();

  rows.forEach((row, index) => {
    const slug = row.slug_value;
    const prevIndex = slugSeen.get(slug);
    if (prevIndex !== undefined) {
      errors.push({
        identifier: slug,
        reason: `Duplicate slug "${slug}" (first seen in row ${prevIndex + 2})`,
      });
    } else {
      slugSeen.set(slug, index);
    }
  });

  return errors;
}

// ─── CSV → ProcessedRows ───────────────────────────────────────────
export function parseMasterCsvToRows(
  defsCsvText: string,
  compCsvText?: string,
): ProcessedRow<ObservationDefinitionRow>[] {
  const { headers, rows } = parseCsvText(defsCsvText);

  if (headers.length === 0) {
    return [];
  }

  // Build normalized header → column index map using canonical names
  const headerIndices: Record<string, number> = {};
  headers.forEach((h, i) => {
    const canonical = OBS_DEF_HEADER_MAP[normalizeHeader(h)];
    if (canonical) {
      headerIndices[canonical] = i;
    }
  });

  // Check required headers
  const missingHeaders = OBS_DEF_REQUIRED_HEADERS.filter(
    (h) => headerIndices[h] === undefined,
  );

  if (missingHeaders.length > 0) {
    return [
      {
        rowIndex: 1,
        raw: [],
        data: {} as ObservationDefinitionRow,
        errors: [`Missing required headers: ${missingHeaders.join(", ")}`],
      },
    ];
  }

  // Parse components CSV if provided
  const componentMap = compCsvText
    ? parseComponentCsv(compCsvText).componentMap
    : new Map<string, ObservationDefinitionComponentCreateSpec[]>();

  // Parse definition rows
  const processedRows: ProcessedRow<ObservationDefinitionRow>[] = rows.map(
    (row, idx) => {
      const rowIndex = idx + 2; // 1-based, +1 for header
      const rawObj = parseObservationDefinitionRowToRaw(row, headerIndices);
      const result = ObservationDefinitionRowSchema.safeParse(rawObj);

      if (!result.success) {
        const errors = result.error.issues.map((i) => i.message);
        return {
          rowIndex,
          raw: row,
          data: {} as ObservationDefinitionRow,
          errors,
        };
      }

      const validatedRow = result.data;
      const additionalErrors = additionalRowValidation(validatedRow);

      // Attach components from components CSV
      const components = componentMap.get(validatedRow.slug_value) ?? [];
      const rowWithComponents: ObservationDefinitionRow = {
        ...validatedRow,
        component: components,
      };

      return {
        rowIndex,
        raw: row,
        data: rowWithComponents,
        errors: additionalErrors,
      };
    },
  );

  // Cross-row validation: duplicate slugs
  const validRows = processedRows
    .filter((r) => r.errors.length === 0)
    .map((r) => r.data);
  const crossRowErrors = validateObservationDefinitionRows(validRows);

  if (crossRowErrors.length > 0) {
    const errorsBySlug = new Map(
      crossRowErrors.map((e) => [e.identifier, e.reason]),
    );
    for (const processed of processedRows) {
      const slug = processed.data.slug_value;
      if (slug && errorsBySlug.has(slug)) {
        processed.errors = [...processed.errors, errorsBySlug.get(slug)!];
      }
    }
  }

  return processedRows;
}

// ─── API Payload Builder ───────────────────────────────────────────
function buildOptionalCode(
  system: string | undefined,
  code: string | undefined,
  display: string | undefined,
): { system: string; code: string; display: string } | null {
  if (!code && !display) return null;
  if (!code || !display || !system) return null;
  return { system, code, display };
}

export function toObservationDefinitionDatapoint(
  row: ObservationDefinitionRow,
  facilityId: string,
  existingSlug?: string,
): ObservationDefinitionCreateSpec & { id?: string } {
  let qualifiedRanges: QualifiedRange[] = [];
  if (row.qualified_ranges) {
    try {
      const parsed = JSON.parse(row.qualified_ranges);
      if (Array.isArray(parsed)) {
        qualifiedRanges = parsed as QualifiedRange[];
      }
    } catch {
      // ignore parse errors — row validation already caught these
    }
  }

  const datapoint: ObservationDefinitionCreateSpec & { id?: string } = {
    slug_value: row.slug_value,
    title: row.title,
    description: row.description,
    status: row.status,
    category: row.category,
    code: {
      system: row.code_system,
      code: row.code_value,
      display: row.code_display,
    },
    permitted_data_type: row.permitted_data_type,
    component: row.component,
    body_site: buildOptionalCode(
      row.body_site_system,
      row.body_site_code,
      row.body_site_display,
    ),
    method: buildOptionalCode(
      row.method_system,
      row.method_code,
      row.method_display,
    ),
    permitted_unit: buildOptionalCode(
      row.permitted_unit_system,
      row.permitted_unit_code,
      row.permitted_unit_display,
    ),
    qualified_ranges: qualifiedRanges,
    facility: facilityId,
  };

  if (row.derived_from_uri?.trim()) {
    datapoint.derived_from_uri = row.derived_from_uri.trim();
  }

  if (existingSlug) {
    datapoint.id = existingSlug;
  }

  return datapoint;
}

// ─── Review Columns ────────────────────────────────────────────────
export const OBS_DEF_REVIEW_COLUMNS: ReviewColumn<ObservationDefinitionRow>[] =
  [
    { header: "Title", accessor: "title", width: "w-48" },
    { header: "Slug", accessor: "slug_value", width: "w-40" },
    { header: "Category", accessor: "category", width: "w-32" },
    { header: "Status", accessor: "status", width: "w-24" },
    {
      header: "Data Type",
      accessor: "permitted_data_type",
      width: "w-28",
    },
    {
      header: "Components",
      accessor: (row) => row.component?.length ?? 0,
      width: "w-24",
    },
  ];
