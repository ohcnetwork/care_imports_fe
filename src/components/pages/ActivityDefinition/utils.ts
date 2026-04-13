import { apis } from "@/apis";
import { ResourceCategoryResourceType } from "@/types/base/resourceCategory/resourceCategory";
import {
  ActivityDefinitionClassification,
  ActivityDefinitionCreateSpec,
  ActivityDefinitionKind,
  ActivityDefinitionProcessedRow,
  ActivityDefinitionStatus,
  ActivityDefinitionUpdateSpec,
} from "@/types/emr/activityDefinition/activityDefinition";
import type { ProcessedRow } from "@/types/importConfig";
import {
  type HealthcareServiceOption,
  type ResolvedRow,
  stripMappingErrors,
} from "@/utils/activityDefinitionHelper";
import { normalizeName } from "@/utils/importHelpers";
import { parseActivityDefinitionCsv } from "@/utils/masterImport/activityDefinition";
import { upsertResourceCategories } from "@/utils/resourceCategory";
import { z } from "zod";

import type { Code } from "@/types/base/code/code";
import type { ReviewColumn } from "@/types/importConfig";

import { normalizeHeader } from "../../../types/common";

// ─── Row Type ─────────────────────────────────────────────────────

export interface ActivityDefinitionCsvRow {
  title: string;
  slug_value: string;
  description: string;
  usage: string;
  status: string;
  classification: string;
  kind: string;
  code: Code;
  body_site: Code | null;
  diagnostic_report_codes: Code[];
  derived_from_uri: string;
  category_name: string;
  specimen_slugs: string[];
  observation_slugs: string[];
  charge_item_slugs: string[];
  charge_item_price: string;
  location_names: string[];
  healthcare_service_name: string;
}

// ─── Headers ──────────────────────────────────────────────────────

export const AD_REQUIRED_HEADERS = [
  "title",
  "description",
  "usage",
  "classification",
  "category_name",
  "code_system",
  "code_value",
  "code_display",
] as const;

const AD_OPTIONAL_HEADERS = [
  "slug_value",
  "status",
  "kind",
  "body_site_system",
  "body_site_code",
  "body_site_display",
  "diagnostic_report_system",
  "diagnostic_report_code",
  "diagnostic_report_display",
  "derived_from_uri",
  "specimen_slugs",
  "observation_slugs",
  "charge_item_slugs",
  "charge_item_price",
  "location_names",
  "healthcare_service_name",
] as const;

export const AD_HEADER_MAP: Record<string, string> = [
  ...AD_REQUIRED_HEADERS,
  ...AD_OPTIONAL_HEADERS,
].reduce(
  (acc, header) => {
    acc[normalizeHeader(header)] = header;
    return acc;
  },
  {} as Record<string, string>,
);

// ─── Zod Schema ───────────────────────────────────────────────────

const CodeSchema = z.object({
  system: z.string().min(1, "Code system is required"),
  code: z.string().min(1, "Code value is required"),
  display: z.string().min(1, "Code display is required"),
});

export const ActivityDefinitionCsvRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug_value: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9_-]+$/,
      "Slug must contain only lowercase letters, digits, hyphens, and underscores",
    ),
  description: z.string().min(1, "Description is required"),
  usage: z.string().min(1, "Usage is required"),
  status: z.nativeEnum(ActivityDefinitionStatus),
  classification: z.nativeEnum(ActivityDefinitionClassification),
  kind: z.nativeEnum(ActivityDefinitionKind),
  code: CodeSchema,
  body_site: CodeSchema.nullable(),
  diagnostic_report_codes: z.array(CodeSchema),
  derived_from_uri: z.string(),
  category_name: z.string().min(1, "Category name is required"),
  specimen_slugs: z.array(z.string()),
  observation_slugs: z.array(z.string()),
  charge_item_slugs: z.array(z.string()),
  charge_item_price: z.string(),
  location_names: z.array(z.string()),
  healthcare_service_name: z.string(),
});

// ─── CSV Row Parser ───────────────────────────────────────────────

function splitCellValues(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildOptionalCode(
  system: string,
  code: string,
  display: string,
): Code | null {
  if (!code && !display) return null;
  if (!code || !display) return null;
  return { system: system || "http://snomed.info/sct", code, display };
}

export function parseActivityDefinitionCsvRow(
  row: string[],
  headerIndices: Record<string, number>,
): Record<string, unknown> {
  const get = (key: string) => row[headerIndices[key]]?.trim() ?? "";

  const title = get("title");
  const slugValue =
    get("slug_value") ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "");
  const codeSystem = get("code_system") || "http://snomed.info/sct";

  // Build diagnostic report codes from comma-separated triplets
  const diagnosticSystems = splitCellValues(get("diagnostic_report_system"));
  const diagnosticCodes = splitCellValues(get("diagnostic_report_code"));
  const diagnosticDisplays = splitCellValues(get("diagnostic_report_display"));

  const diagnosticReportCodes: Code[] = [];
  if (
    diagnosticSystems.length > 0 &&
    diagnosticCodes.length > 0 &&
    diagnosticDisplays.length > 0 &&
    diagnosticSystems.length === diagnosticCodes.length &&
    diagnosticCodes.length === diagnosticDisplays.length
  ) {
    for (let i = 0; i < diagnosticCodes.length; i++) {
      diagnosticReportCodes.push({
        system: diagnosticSystems[i],
        code: diagnosticCodes[i],
        display: diagnosticDisplays[i],
      });
    }
  }

  return {
    title,
    slug_value: slugValue,
    description: get("description"),
    usage: get("usage"),
    status: get("status") || "active",
    classification: get("classification") || "laboratory",
    kind: get("kind") || "service_request",
    code: {
      system: codeSystem,
      code: get("code_value"),
      display: get("code_display"),
    },
    body_site: buildOptionalCode(
      get("body_site_system"),
      get("body_site_code"),
      get("body_site_display"),
    ),
    diagnostic_report_codes: diagnosticReportCodes,
    derived_from_uri: get("derived_from_uri"),
    category_name: get("category_name"),
    specimen_slugs: splitCellValues(get("specimen_slugs")),
    observation_slugs: splitCellValues(get("observation_slugs")),
    charge_item_slugs: splitCellValues(get("charge_item_slugs")),
    charge_item_price: get("charge_item_price"),
    location_names: splitCellValues(get("location_names")),
    healthcare_service_name: get("healthcare_service_name"),
  };
}

// ─── Cross-Row Validation ─────────────────────────────────────────

/**
 * Synchronous cross-row checks (duplicates, etc.).
 */
function validateActivityDefinitionCsvRowsSync(
  rows: ActivityDefinitionCsvRow[],
): { identifier: string; reason: string }[] {
  const errors: { identifier: string; reason: string }[] = [];
  const slugSeen = new Map<string, number>();

  rows.forEach((row, index) => {
    const slug = row.slug_value;
    const prevIndex = slugSeen.get(slug);
    if (prevIndex !== undefined) {
      errors.push({
        identifier: slug,
        reason: `Duplicate slug_value "${slug}" (first seen in row ${prevIndex + 2})`,
      });
    } else {
      slugSeen.set(slug, index);
    }
  });

  return errors;
}

/**
 * Async cross-row validation that also checks dependency existence against the backend.
 * Returns errors that will be shown in the review table.
 */
export async function validateActivityDefinitionCsvRowsAsync(
  rows: ActivityDefinitionCsvRow[],
  facilityId: string,
): Promise<{ identifier: string; reason: string }[]> {
  const errors = validateActivityDefinitionCsvRowsSync(rows);

  // Collect all unique dependency references across rows
  const allSpecimenSlugs = new Set<string>();
  const allObservationSlugs = new Set<string>();
  const allChargeItemSlugs = new Set<string>();
  const allLocationNames = new Set<string>();
  const allHealthcareServiceNames = new Set<string>();

  for (const row of rows) {
    for (const s of row.specimen_slugs) allSpecimenSlugs.add(s);
    for (const s of row.observation_slugs) allObservationSlugs.add(s);
    for (const s of row.charge_item_slugs) allChargeItemSlugs.add(s);
    for (const n of row.location_names) allLocationNames.add(n);
    if (row.healthcare_service_name)
      allHealthcareServiceNames.add(row.healthcare_service_name);
  }

  // Resolve all dependencies in parallel
  const specimenResults = new Map<string, boolean>();
  const observationResults = new Map<string, boolean>();
  const chargeItemResults = new Map<string, boolean>();
  const locationResults = new Map<string, boolean>();
  const hsResults = new Map<string, boolean>();

  await Promise.all([
    // Check specimen slugs
    ...Array.from(allSpecimenSlugs).map(async (slug) => {
      try {
        await apis.facility.specimenDefinition.get(
          facilityId,
          `f-${facilityId}-${slug}`,
        );
        specimenResults.set(slug, true);
      } catch {
        specimenResults.set(slug, false);
      }
    }),

    // Check observation slugs
    ...Array.from(allObservationSlugs).map(async (slug) => {
      try {
        await apis.facility.observationDefinition.get(
          `f-${facilityId}-${slug}`,
          { facility: facilityId },
        );
        observationResults.set(slug, true);
      } catch {
        observationResults.set(slug, false);
      }
    }),

    // Check charge item slugs (batch fetch)
    (async () => {
      if (allChargeItemSlugs.size === 0) return;
      try {
        const response = await apis.facility.chargeItemDefinition.list(
          facilityId,
          { limit: 500 },
        );
        const existingSlugs = new Set(
          response.results.map((item) => item.slug),
        );
        for (const slug of allChargeItemSlugs) {
          chargeItemResults.set(
            slug,
            existingSlugs.has(slug) ||
              existingSlugs.has(`f-${facilityId}-${slug}`),
          );
        }
      } catch {
        for (const slug of allChargeItemSlugs) {
          chargeItemResults.set(slug, false);
        }
      }
    })(),

    // Check locations by name (batch fetch)
    (async () => {
      if (allLocationNames.size === 0) return;
      try {
        const response = await apis.facility.location.list(facilityId, {
          limit: 500,
        });
        const existingNames = new Set(
          response.results.map((loc) => normalizeName(loc.name)),
        );
        for (const name of allLocationNames) {
          locationResults.set(name, existingNames.has(normalizeName(name)));
        }
      } catch {
        for (const name of allLocationNames) {
          locationResults.set(name, false);
        }
      }
    })(),

    // Check healthcare services (batch fetch)
    (async () => {
      if (allHealthcareServiceNames.size === 0) return;
      try {
        const response = await apis.facility.healthcareService.list(
          facilityId,
          { limit: 200 },
        );
        const existingNames = new Set(
          response.results.map((svc) => normalizeName(svc.name)),
        );
        for (const name of allHealthcareServiceNames) {
          hsResults.set(name, existingNames.has(normalizeName(name)));
        }
      } catch {
        for (const name of allHealthcareServiceNames) {
          hsResults.set(name, false);
        }
      }
    })(),
  ]);

  // Map dependency failures back to individual rows
  for (const row of rows) {
    const slug = row.slug_value;

    for (const s of row.specimen_slugs) {
      if (!specimenResults.get(s)) {
        errors.push({
          identifier: slug,
          reason: `Specimen definition not found: ${s}`,
        });
      }
    }

    for (const s of row.observation_slugs) {
      if (!observationResults.get(s)) {
        errors.push({
          identifier: slug,
          reason: `Observation definition not found: ${s}`,
        });
      }
    }

    for (const s of row.charge_item_slugs) {
      if (!chargeItemResults.get(s)) {
        errors.push({
          identifier: slug,
          reason: `Charge item definition not found: ${s}`,
        });
      }
    }

    for (const name of row.location_names) {
      if (!locationResults.get(name)) {
        errors.push({
          identifier: slug,
          reason: `Location not found: ${name}`,
        });
      }
    }

    if (
      row.healthcare_service_name &&
      !hsResults.get(row.healthcare_service_name)
    ) {
      errors.push({
        identifier: slug,
        reason: `Healthcare service not found: ${row.healthcare_service_name}`,
      });
    }
  }

  return errors;
}

/**
 * Default sync-only validation (duplicate slugs). Used when no facilityId is available.
 */
export function validateActivityDefinitionCsvRows(
  rows: ActivityDefinitionCsvRow[],
): { identifier: string; reason: string }[] {
  return validateActivityDefinitionCsvRowsSync(rows);
}

// ─── Review Columns ───────────────────────────────────────────────

export const AD_CSV_REVIEW_COLUMNS: ReviewColumn<ActivityDefinitionCsvRow>[] = [
  { header: "Title", accessor: "title", width: "w-48" },
  { header: "Slug", accessor: "slug_value" },
  { header: "Classification", accessor: "classification" },
  { header: "Category", accessor: "category_name" },
  { header: "Status", accessor: "status" },
];

// ─── Sample CSV ───────────────────────────────────────────────────

export const AD_SAMPLE_CSV = {
  headers: [
    ...AD_REQUIRED_HEADERS,
    ...AD_OPTIONAL_HEADERS,
  ] as unknown as string[],
  rows: [
    [
      "Complete Blood Count",
      "Complete blood count test",
      "Order CBC for baseline evaluation",
      "laboratory",
      "Hematology",
      "http://snomed.info/sct",
      "26604007",
      "Complete blood count",
      "complete-blood-count",
      "active",
      "service_request",
      "",
      "",
      "",
      "http://loinc.org",
      "718-7",
      "Hemoglobin [Mass/volume] in Blood",
      "",
      "whole-blood",
      "hemoglobin, platelet-count",
      "cbc-charge-item",
      "",
      "Main Lab",
      "General Medicine",
    ],
  ],
};

export type ActivityDefinitionRow = ActivityDefinitionProcessedRow["data"] & {
  resolved?: ResolvedRow;
};

export type ActivityDefinitionProcessedRowWithResolved =
  ProcessedRow<ActivityDefinitionRow>;

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Parse CSV text into ProcessedRows for ImportFlow.
 * Wraps the existing parseActivityDefinitionCsv utility.
 */
export function parseMasterCsvToRows(
  csvText: string,
): ProcessedRow<ActivityDefinitionRow>[] {
  const rows = parseActivityDefinitionCsv(csvText);
  return rows.map((row) => ({
    rowIndex: row.rowIndex,
    data: { ...row.data },
    errors: [...row.errors],
    raw: [],
  }));
}

// ─── Reference Resolution ─────────────────────────────────────────────────────

export interface ResolveReferencesResult {
  rows: ProcessedRow<ActivityDefinitionRow>[];
  healthcareServices: HealthcareServiceOption[];
  categorySlugMap: Map<string, string>;
  hasUnresolvedHealthcareServices: boolean;
}

/**
 * Resolve all external references for a batch of rows:
 * - specimen slugs → validate existence
 * - observation slugs → validate existence
 * - charge item slugs → find by activity title
 * - location names → find IDs
 * - resource categories → upsert once (batch)
 * - healthcare services → fetch list (for mapping UI if needed)
 *
 * Rows with unresolvable references get errors attached.
 * Healthcare service resolution is deferred to the mapping step.
 */
export async function resolveReferences(
  rows: ProcessedRow<ActivityDefinitionRow>[],
  facilityId: string,
): Promise<ResolveReferencesResult> {
  const validSpecimenSlugs = new Set<string>();
  const validObservationSlugs = new Set<string>();
  const chargeItemMap: Record<string, string> = {};
  const locationMap: Record<string, string> = {};

  // Collect unique values
  const uniqueSpecimenSlugs = new Set<string>();
  const uniqueObservationSlugs = new Set<string>();
  const uniqueActivityTitles = new Set<string>();
  const uniqueLocations = new Set<string>();
  const categoryNames: string[] = [];

  rows.forEach((row) => {
    row.data.specimen_slugs.forEach((slug) => uniqueSpecimenSlugs.add(slug));
    row.data.observation_slugs.forEach((slug) =>
      uniqueObservationSlugs.add(slug),
    );
    const title = row.data.title.trim();
    if (title) uniqueActivityTitles.add(title);
    row.data.location_names.forEach((name) => uniqueLocations.add(name));
    if (row.data.category_name.trim()) {
      categoryNames.push(row.data.category_name);
    }
  });

  // Run all lookups in parallel
  const [, , , , healthcareServicesResponse, categorySlugMap] =
    await Promise.all([
      // Specimen slugs
      Promise.all(
        Array.from(uniqueSpecimenSlugs).map(async (slug) => {
          try {
            await apis.facility.specimenDefinition.get(
              facilityId,
              `f-${facilityId}-${slug}`,
            );
            validSpecimenSlugs.add(slug);
          } catch {
            // will surface as error on rows below
          }
        }),
      ),

      // Observation slugs
      Promise.all(
        Array.from(uniqueObservationSlugs).map(async (slug) => {
          try {
            await apis.facility.observationDefinition.get(
              `f-${facilityId}-${slug}`,
            );
            validObservationSlugs.add(slug);
          } catch {
            // will surface as error on rows below
          }
        }),
      ),

      // Charge items (match by activity title)
      Promise.all(
        Array.from(uniqueActivityTitles).map(async (title) => {
          try {
            const response = await apis.facility.chargeItemDefinition.list(
              facilityId,
              { title, limit: 10 },
            );
            const match = response.results.find(
              (item) => normalizeName(item.title) === normalizeName(title),
            );
            if (match) {
              chargeItemMap[normalizeName(title)] = match.slug;
            }
          } catch {
            // will surface as error on rows below
          }
        }),
      ),

      // Locations
      Promise.all(
        Array.from(uniqueLocations).map(async (name) => {
          try {
            const response = await apis.facility.location.list(facilityId, {
              name,
              limit: 50,
            });
            const match = response.results.find(
              (item) => normalizeName(item.name) === normalizeName(name),
            );
            if (match) {
              locationMap[normalizeName(name)] = match.id;
            }
          } catch {
            // will surface as error on rows below
          }
        }),
      ),

      // Healthcare services (fetch list for mapping UI)
      apis.facility.healthcareService
        .list(facilityId, { limit: 200 })
        .catch(() => ({ results: [] })),

      // Resource categories — single batch upsert
      upsertResourceCategories({
        facilityId,
        categories: categoryNames,
        resourceType: ResourceCategoryResourceType.activity_definition,
        slugPrefix: "ad",
      }),
    ]);

  const healthcareServices = ((
    healthcareServicesResponse as { results: HealthcareServiceOption[] }
  ).results ?? []) as HealthcareServiceOption[];

  // Attach resolved data and errors to each row
  const resolvedRows = rows.map((row) => {
    const updatedErrors = stripMappingErrors(row.errors);
    const resolved: ResolvedRow = {
      specimenSlugs: [],
      observationSlugs: [],
      chargeItemSlugs: [],
      locationIds: [],
      categorySlug:
        categorySlugMap.get(normalizeName(row.data.category_name)) ?? "",
      healthcareServiceId: null,
    };

    row.data.specimen_slugs.forEach((slug) => {
      if (validSpecimenSlugs.has(slug)) {
        resolved.specimenSlugs.push(slug);
      } else {
        updatedErrors.push(`Specimen slug not found: ${slug}`);
      }
    });

    row.data.observation_slugs.forEach((slug) => {
      if (validObservationSlugs.has(slug)) {
        resolved.observationSlugs.push(slug);
      } else {
        updatedErrors.push(`Observation slug not found: ${slug}`);
      }
    });

    row.data.location_names.forEach((name) => {
      const id = locationMap[normalizeName(name)];
      if (id) {
        resolved.locationIds.push(id);
      } else {
        updatedErrors.push(`Location not found: ${name}`);
      }
    });

    const title = row.data.title.trim();
    if (title) {
      const slug = chargeItemMap[normalizeName(title)];
      if (slug) {
        resolved.chargeItemSlugs.push(slug);
      } else {
        updatedErrors.push(
          `Charge item not found for activity definition: ${title}`,
        );
      }
    }

    return {
      ...row,
      errors: updatedErrors,
      data: { ...row.data, resolved },
    };
  });

  // Check if any row needs healthcare service mapping
  const hasUnresolvedHealthcareServices = resolvedRows.some(
    (row) => row.errors.length === 0 && !row.data.resolved?.healthcareServiceId,
  );

  return {
    rows: resolvedRows,
    healthcareServices,
    categorySlugMap,
    hasUnresolvedHealthcareServices,
  };
}

/**
 * Apply healthcare service selections from the mapping UI to the rows.
 * Maps category_name → healthcareServiceId via the categoryMappings record.
 */
export function applyHealthcareServiceMappings(
  rows: ProcessedRow<ActivityDefinitionRow>[],
  categoryMappings: Record<string, string>,
): ProcessedRow<ActivityDefinitionRow>[] {
  return rows.map((row) => {
    const healthcareServiceId =
      categoryMappings[row.data.category_name] ?? null;
    const updatedErrors = stripMappingErrors(row.errors);
    if (!healthcareServiceId) {
      updatedErrors.push(
        `Healthcare service not found: ${row.data.category_name}`,
      );
    }
    return {
      ...row,
      errors: updatedErrors,
      data: {
        ...row.data,
        resolved: row.data.resolved
          ? { ...row.data.resolved, healthcareServiceId }
          : undefined,
      },
    };
  });
}

// ─── Payload Builder ──────────────────────────────────────────────────────────

/**
 * Build the upsert datapoint payload from a resolved ActivityDefinitionRow.
 */
export function toActivityDefinitionDatapoint(
  row: ActivityDefinitionRow,
  facilityId: string,
  existingSlug?: string,
): ActivityDefinitionCreateSpec | ActivityDefinitionUpdateSpec {
  const resolved = row.resolved;
  const payload: ActivityDefinitionCreateSpec = {
    slug_value: row.slug_value,
    title: row.title,
    status: row.status as ActivityDefinitionStatus,
    description: row.description,
    usage: row.usage,
    classification: row.classification as ActivityDefinitionClassification,
    kind: row.kind as ActivityDefinitionKind,
    code: row.code,
    body_site: row.body_site,
    diagnostic_report_codes: row.diagnostic_report_codes,
    derived_from_uri: row.derived_from_uri || null,
    facility: facilityId,
    specimen_requirements: (resolved?.specimenSlugs ?? []).map(
      (s) => `f-${facilityId}-${s}`,
    ),
    observation_result_requirements: (resolved?.observationSlugs ?? []).map(
      (s) => `f-${facilityId}-${s}`,
    ),
    charge_item_definitions: (resolved?.chargeItemSlugs ?? []).map(
      (s) => `f-${facilityId}-${s}`,
    ),
    locations: resolved?.locationIds ?? [],
    category: resolved?.categorySlug ?? "",
    healthcare_service: resolved?.healthcareServiceId ?? null,
  };

  if (existingSlug) {
    (payload as ActivityDefinitionUpdateSpec).id = existingSlug;
  }

  return payload;
}

// ─── Review Columns ───────────────────────────────────────────────────────────

export const AD_REVIEW_COLUMNS: ReviewColumn<ActivityDefinitionRow>[] = [
  { header: "Title", accessor: (row) => row.title ?? "" },
  { header: "Slug", accessor: (row) => row.slug_value ?? "" },
  { header: "Classification", accessor: (row) => row.classification ?? "" },
  { header: "Status", accessor: (row) => row.status ?? "" },
];
