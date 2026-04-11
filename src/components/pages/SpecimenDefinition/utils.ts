import { z } from "zod";

import type { ProcessedRow, ReviewColumn } from "@/types/importConfig";
import {
  ContainerSpec,
  Preference,
  SpecimenDefinitionCreate,
  SpecimenDefinitionStatus,
  TypeTestedSpec,
  type CodeReference,
  type SpecimenRow,
} from "@/types/emr/specimenDefinition/specimenDefinition";
import { parseSpecimenDefinitionCsv } from "@/utils/masterImport/specimenDefinition";

import { CodeSchema, normalizeHeader, zodDecimal } from "../../../types/common";
import { query } from "@/utils/api";
import valueSetApi from "../../../types/valueset/valueSetApi";

export type {
  CodeReference,
  SpecimenRow,
} from "@/types/emr/specimenDefinition/specimenDefinition";

// ─── Zod Schemas ──────────────────────────────────────────────────

const QuantitySpecSchema = z.object({
  value: zodDecimal(),
  unit: CodeSchema,
});

const MinimumVolumeSpecSchema = z.object({
  quantity: QuantitySpecSchema.optional().nullable(),
  string: z.string().optional(),
});

const TypeTestedSchema = z.object({
  is_derived: z.boolean(),
  preference: z.nativeEnum(Preference),
  container: z
    .object({
      description: z.string().optional(),
      capacity: QuantitySpecSchema.nullable().optional(),
      minimum_volume: MinimumVolumeSpecSchema.optional(),
      cap: CodeSchema.optional(),
      preparation: z.string().optional(),
    })
    .nullable()
    .optional(),
  requirement: z.string().optional(),
  retention_time: z
    .object({
      value: zodDecimal(),
      unit: CodeSchema,
    })
    .nullable()
    .optional(),
  single_use: z.boolean().nullable(),
});

export const SpecimenDefinitionRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug_value: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9_-]+$/,
      "Slug must contain only lowercase letters, digits, hyphens, and underscores",
    ),
  status: z.nativeEnum(SpecimenDefinitionStatus).optional(),
  description: z.string().min(1, "Description is required"),
  derived_from_uri: z.string().url("Must be a valid URL").optional(),
  type_collected: CodeSchema,
  patient_preparation: z.array(CodeSchema).min(0),
  collection: CodeSchema.optional(),
  type_tested: TypeTestedSchema.optional(),
});

// ─── Row Type ─────────────────────────────────────────────────────

/** Row type for CSV-based imports (derived from zod schema). */
export type SpecimenDefinitionCsvRow = z.infer<
  typeof SpecimenDefinitionRowSchema
>;

/**
 * SpecimenDefinitionRow extends SpecimenRow with codeReferences so they
 * travel with the row through the ImportFlow lifecycle.
 * Used by the master data path; the CSV path uses SpecimenDefinitionCsvRow.
 */
export interface SpecimenDefinitionRow extends SpecimenRow {
  codeReferences: CodeReference[];
}

// ─── CSV → ProcessedRows ───────────────────────────────────────────
export function parseMasterCsvToRows(
  csvText: string,
): ProcessedRow<SpecimenDefinitionRow>[] {
  let specimenRows;
  try {
    specimenRows = parseSpecimenDefinitionCsv(csvText);
  } catch (err) {
    return [
      {
        rowIndex: 1,
        raw: [],
        data: {} as SpecimenDefinitionRow,
        errors: [err instanceof Error ? err.message : "Failed to parse CSV"],
      },
    ];
  }

  return specimenRows.map((r) => ({
    rowIndex: r.rowIndex,
    raw: [],
    data: { ...r.data, codeReferences: r.codeReferences },
    errors: [...r.errors],
  }));
}

// ─── Code Lookup Validation ───────────────────────────────────────

/**
 * Async cross-row validation for master data rows: duplicate slugs + code lookups
 * using the codeReferences attached during parsing.
 */
export async function validateSpecimenDefinitionMasterRows(
  rows: SpecimenDefinitionRow[],
): Promise<{ identifier: string; reason: string }[]> {
  const errors: { identifier: string; reason: string }[] = [];

  // Duplicate slug check
  const slugSeen = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const slug = (rows[i].slug_value ?? "").trim().toLowerCase();
    const prevIdx = slugSeen.get(slug);
    if (prevIdx !== undefined) {
      errors.push({
        identifier: slug,
        reason: `Duplicate slug_value (first seen in row ${prevIdx + 2})`,
      });
    } else {
      slugSeen.set(slug, i);
    }
  }

  // Collect unique code references across all rows
  const uniqueRefs = new Map<string, CodeReference>();
  for (const row of rows) {
    for (const ref of row.codeReferences ?? []) {
      if (!uniqueRefs.has(ref.signature)) {
        uniqueRefs.set(ref.signature, ref);
      }
    }
  }

  if (uniqueRefs.size > 0) {
    const invalidSignatures = new Set<string>();
    await Promise.all(
      Array.from(uniqueRefs.values()).map(async (ref) => {
        try {
          await query(valueSetApi.lookupCode, {
            body: { system: ref.code.system, code: ref.code.code },
          });
        } catch {
          invalidSignatures.add(ref.signature);
        }
      }),
    );

    if (invalidSignatures.size > 0) {
      for (const row of rows) {
        const slug = (row.slug_value ?? "").trim().toLowerCase();
        for (const ref of row.codeReferences ?? []) {
          if (invalidSignatures.has(ref.signature)) {
            errors.push({
              identifier: slug,
              reason: `Invalid code: ${ref.label} (${ref.code.system} | ${ref.code.code})`,
            });
          }
        }
      }
    }
  }

  return errors;
}

// ─── Payload Builder ──────────────────────────────────────────────
function cleanContainerData(
  container?: ContainerSpec | null,
): ContainerSpec | undefined {
  if (!container) return undefined;
  const hasContent =
    container.description ||
    container.preparation ||
    container.capacity ||
    container.cap ||
    container.minimum_volume?.quantity ||
    container.minimum_volume?.string;

  if (!hasContent) return undefined;

  const cleaned = { ...container };
  if (
    container.minimum_volume &&
    !container.minimum_volume.quantity &&
    !container.minimum_volume.string
  ) {
    delete cleaned.minimum_volume;
  }

  return cleaned;
}

export function toSpecimenDefinitionDatapoint(
  row: SpecimenDefinitionRow,
  existingSlug?: string,
): SpecimenDefinitionCreate & { id?: string } {
  const slug = row.slug_value!;

  const hasTypeTested =
    row.is_derived !== undefined ||
    row.preference !== undefined ||
    row.single_use !== undefined ||
    row.requirement ||
    row.retention_time ||
    row.container;

  const typeTested: TypeTestedSpec | undefined = hasTypeTested
    ? {
        is_derived: row.is_derived ?? false,
        preference: row.preference ?? Preference.preferred,
        single_use: row.single_use ?? false,
        requirement: row.requirement || undefined,
        retention_time: row.retention_time || undefined,
        container: cleanContainerData(row.container),
      }
    : undefined;

  const payload: SpecimenDefinitionCreate & { id?: string } = {
    slug_value: slug,
    title: row.title,
    status: row.status ?? SpecimenDefinitionStatus.active,
    description: row.description,
    derived_from_uri: row.derived_from_uri || undefined,
    type_collected: row.type_collected,
    patient_preparation: [],
    collection: row.collection || undefined,
    type_tested: typeTested,
  };

  if (existingSlug) {
    payload.id = existingSlug;
  }

  return payload;
}

/** Build an API payload from a zod-validated CSV row. */
export function toSpecimenDefinitionCsvPayload(
  row: SpecimenDefinitionCsvRow,
  existingSlug?: string,
): SpecimenDefinitionCreate & { id?: string } {
  const payload: SpecimenDefinitionCreate & { id?: string } = {
    slug_value: row.slug_value,
    title: row.title,
    status: row.status ?? SpecimenDefinitionStatus.active,
    description: row.description,
    derived_from_uri: row.derived_from_uri || undefined,
    type_collected: row.type_collected,
    patient_preparation: row.patient_preparation ?? [],
    collection: row.collection || undefined,
    type_tested: row.type_tested
      ? {
          is_derived: row.type_tested.is_derived,
          preference: row.type_tested.preference,
          single_use: row.type_tested.single_use ?? false,
          requirement: row.type_tested.requirement || undefined,
          retention_time: row.type_tested.retention_time || undefined,
          container: cleanContainerData(row.type_tested.container),
        }
      : undefined,
  };

  if (existingSlug) {
    payload.id = existingSlug;
  }

  return payload;
}

// ─── Review Columns ────────────────────────────────────────────────
export const SD_REVIEW_COLUMNS: ReviewColumn<SpecimenDefinitionRow>[] = [
  { header: "Title", accessor: "title", width: "w-48" },
  { header: "Slug", accessor: "slug_value", width: "w-40" },
  {
    header: "Type Collected",
    accessor: (row) => row.type_collected?.display ?? "",
    width: "w-40",
  },
  { header: "Status", accessor: "status", width: "w-24" },
];

export const SD_CSV_REVIEW_COLUMNS: ReviewColumn<SpecimenDefinitionCsvRow>[] = [
  { header: "Title", accessor: "title", width: "w-48" },
  { header: "Slug", accessor: "slug_value", width: "w-40" },
  {
    header: "Type Collected",
    accessor: (row) => row.type_collected?.display ?? "",
    width: "w-40",
  },
  {
    header: "Status",
    accessor: (row) => row.status ?? SpecimenDefinitionStatus.active,
    width: "w-24",
  },
];

// ─── CSV Headers ──────────────────────────────────────────────────

export const SD_REQUIRED_HEADERS = [
  "title",
  "slug_value",
  "description",
  "type_collected_system",
  "type_collected_code",
  "type_collected_display",
] as const;

export const SD_OPTIONAL_HEADERS = [
  "derived_from_uri",
  "collection_system",
  "collection_code",
  "collection_display",
  "is_derived",
  "preference",
  "single_use",
  "requirement",
  "retention_value",
  "retention_unit_system",
  "retention_unit_code",
  "retention_unit_display",
  "container_description",
  "container_capacity_value",
  "container_capacity_unit_system",
  "container_capacity_unit_code",
  "container_capacity_unit_display",
  "container_minimum_volume_quantity_value",
  "container_minimum_volume_quantity_unit_system",
  "container_minimum_volume_quantity_unit_code",
  "container_minimum_volume_quantity_unit_display",
  "container_minimum_volume_string",
  "container_cap_system",
  "container_cap_code",
  "container_cap_display",
  "container_preparation",
] as const;

export const SD_HEADER_MAP: Record<string, string> = [
  ...SD_REQUIRED_HEADERS,
  ...SD_OPTIONAL_HEADERS,
].reduce(
  (acc, header) => {
    acc[normalizeHeader(header)] = header;
    return acc;
  },
  {} as Record<string, string>,
);

// ─── CSV Row Parser ───────────────────────────────────────────────

function parseBoolean(value: string): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
}

function buildCode(
  system: string,
  code: string,
  display: string,
): { system: string; code: string; display: string } | undefined {
  if (!system && !code && !display) return undefined;
  return { system, code, display };
}

function buildQuantity(
  value: string,
  system: string,
  code: string,
  display: string,
):
  | { value: string; unit: { system: string; code: string; display: string } }
  | undefined {
  if (!value && !system && !code && !display) return undefined;
  return { value, unit: { system, code, display } };
}

/**
 * Transform a flat CSV row array into a structured object for zod validation.
 * Assembles nested Code/Quantity/Container objects from flat columns.
 */
export function parseSpecimenDefinitionRow(
  row: string[],
  headerIndices: Record<string, number>,
): Record<string, unknown> {
  const get = (key: string) => row[headerIndices[key]]?.trim() ?? "";

  const typeCollected = buildCode(
    get("type_collected_system"),
    get("type_collected_code"),
    get("type_collected_display"),
  );

  const collection = buildCode(
    get("collection_system"),
    get("collection_code"),
    get("collection_display"),
  );

  const retentionTime = buildQuantity(
    get("retention_value"),
    get("retention_unit_system"),
    get("retention_unit_code"),
    get("retention_unit_display"),
  );

  const containerCapacity = buildQuantity(
    get("container_capacity_value"),
    get("container_capacity_unit_system"),
    get("container_capacity_unit_code"),
    get("container_capacity_unit_display"),
  );

  const minimumVolumeQuantity = buildQuantity(
    get("container_minimum_volume_quantity_value"),
    get("container_minimum_volume_quantity_unit_system"),
    get("container_minimum_volume_quantity_unit_code"),
    get("container_minimum_volume_quantity_unit_display"),
  );

  const minimumVolumeString =
    get("container_minimum_volume_string") || undefined;

  const containerCap = buildCode(
    get("container_cap_system"),
    get("container_cap_code"),
    get("container_cap_display"),
  );

  const containerDescription = get("container_description") || undefined;
  const containerPreparation = get("container_preparation") || undefined;

  const hasContainer =
    containerDescription ||
    containerCapacity ||
    minimumVolumeQuantity ||
    minimumVolumeString ||
    containerCap ||
    containerPreparation;

  const isDerived = parseBoolean(get("is_derived"));
  const singleUse = parseBoolean(get("single_use"));
  const preferenceRaw = get("preference");

  const hasTypeTested =
    isDerived !== undefined ||
    preferenceRaw ||
    singleUse !== undefined ||
    get("requirement") ||
    retentionTime ||
    hasContainer;

  const typeTested = hasTypeTested
    ? {
        is_derived: isDerived ?? false,
        preference: preferenceRaw || Preference.preferred,
        single_use: singleUse ?? null,
        requirement: get("requirement") || undefined,
        retention_time: retentionTime || undefined,
        container: hasContainer
          ? {
              description: containerDescription,
              capacity: containerCapacity || undefined,
              minimum_volume:
                minimumVolumeQuantity || minimumVolumeString
                  ? {
                      quantity: minimumVolumeQuantity || undefined,
                      string: minimumVolumeString,
                    }
                  : undefined,
              cap: containerCap,
              preparation: containerPreparation,
            }
          : undefined,
      }
    : undefined;

  const derivedFromUri = get("derived_from_uri") || undefined;

  return {
    title: get("title"),
    slug_value: get("slug_value"),
    description: get("description"),
    derived_from_uri: derivedFromUri,
    type_collected: typeCollected,
    patient_preparation: [],
    collection,
    type_tested: typeTested,
  };
}

// ─── Cross-Row Validation ─────────────────────────────────────────

function validateSpecimenDefinitionRowsSync(
  rows: SpecimenDefinitionCsvRow[],
): { identifier: string; reason: string }[] {
  const errors: { identifier: string; reason: string }[] = [];
  const slugSeen = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const slug = rows[i].slug_value.trim().toLowerCase();
    const prevIdx = slugSeen.get(slug);

    if (prevIdx !== undefined) {
      errors.push({
        identifier: slug,
        reason: `Duplicate slug_value (first seen in row ${prevIdx + 2})`,
      });
    } else {
      slugSeen.set(slug, i);
    }
  }

  return errors;
}

/**
 * Collect all codes from a row as [signature, label] pairs.
 */
function getRowCodes(
  row: SpecimenDefinitionCsvRow,
): { sig: string; label: string }[] {
  const codes: { sig: string; label: string }[] = [];

  const add = (
    code: { system: string; code: string } | undefined | null,
    label: string,
  ) => {
    if (code?.system && code?.code) {
      codes.push({ sig: `${code.system}|${code.code}`, label });
    }
  };

  add(row.type_collected, "Type Collected");
  add(row.collection, "Collection");
  if (row.type_tested) {
    add(row.type_tested.container?.cap, "Container Cap");
    add(row.type_tested.retention_time?.unit, "Retention Time Unit");
    add(row.type_tested.container?.capacity?.unit, "Container Capacity Unit");
    add(
      row.type_tested.container?.minimum_volume?.quantity?.unit,
      "Minimum Volume Unit",
    );
  }

  return codes;
}

/**
 * Async cross-row validation: duplicate slugs + code lookups.
 */
export async function validateSpecimenDefinitionRows(
  rows: SpecimenDefinitionCsvRow[],
): Promise<{ identifier: string; reason: string }[]> {
  const errors = validateSpecimenDefinitionRowsSync(rows);

  // Collect unique codes across all rows
  const uniqueCodes = new Map<string, { system: string; code: string }>();
  for (const row of rows) {
    for (const { sig } of getRowCodes(row)) {
      if (!uniqueCodes.has(sig)) {
        const [system, code] = sig.split("|");
        uniqueCodes.set(sig, { system, code });
      }
    }
  }

  if (uniqueCodes.size === 0) return errors;

  // Validate all codes in parallel
  const invalidCodes = new Set<string>();
  await Promise.all(
    Array.from(uniqueCodes.entries()).map(async ([sig, body]) => {
      try {
        await query(valueSetApi.lookupCode, { body });
      } catch {
        invalidCodes.add(sig);
      }
    }),
  );

  if (invalidCodes.size === 0) return errors;

  // Map failures back to rows
  for (const row of rows) {
    const slug = row.slug_value.trim().toLowerCase();
    for (const { sig, label } of getRowCodes(row)) {
      if (invalidCodes.has(sig)) {
        errors.push({
          identifier: slug,
          reason: `Invalid code: ${label} (${sig.replace("|", " | ")})`,
        });
      }
    }
  }

  return errors;
}

// ─── Sample CSV ───────────────────────────────────────────────────

export const SD_SAMPLE_CSV = {
  headers: [
    ...SD_REQUIRED_HEADERS,
    ...SD_OPTIONAL_HEADERS,
  ] as unknown as string[],
  rows: [
    [
      "Blood",
      "blood",
      "Blood specimen",
      "http://terminology.hl7.org/CodeSystem/v2-0487",
      "ACNFLD",
      "Fluid, Acne",
      "",
      "http://snomed.info/sct",
      "278450005",
      "Finger stick",
      "true",
      "preferred",
      "true",
      "Requirement",
      "1.00",
      "http://unitsofmeasure.org",
      "h",
      "hours",
      "Container Description",
      "5.00",
      "http://unitsofmeasure.org",
      "mL",
      "milliliter",
      "5.00",
      "http://unitsofmeasure.org",
      "mL",
      "milliliter",
      "",
      "http://terminology.hl7.org/CodeSystem/container-cap",
      "black",
      "black cap",
      "Container Prep",
    ],
  ],
};
