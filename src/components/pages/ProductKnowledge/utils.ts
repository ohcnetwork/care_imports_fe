import { z } from "zod";
import { normalizeHeader, SlugSchema } from "../../../types/common";

// ─── Enums ─────────────────────────────────────────────────────────
export const ProductKnowledgeTypeSchema = z.enum([
  "medication",
  "consumable",
  "nutritional_product",
]);
export type ProductKnowledgeType = z.infer<typeof ProductKnowledgeTypeSchema>;

export const ProductKnowledgeStatusSchema = z.enum([
  "draft",
  "active",
  "retired",
]);
export type ProductKnowledgeStatus = z.infer<
  typeof ProductKnowledgeStatusSchema
>;

export const ProductNameTypeSchema = z.enum([
  "trade_name",
  "alias",
  "original_name",
  "preferred",
]);
export type ProductNameType = z.infer<typeof ProductNameTypeSchema>;

// ─── Code Systems ──────────────────────────────────────────────────
export const SNOMED_SYSTEM = "http://snomed.info/sct";
export const UCUM_SYSTEM = "http://unitsofmeasure.org";

// ─── Dosage Units Lookup ───────────────────────────────────────────
export const DOSAGE_UNITS_CODES = [
  { system: UCUM_SYSTEM, code: "{tbl}", display: "tablets" },
  { system: UCUM_SYSTEM, code: "{Capsule}", display: "capsules" },
  { system: UCUM_SYSTEM, code: "mL", display: "milliliter" },
  { system: UCUM_SYSTEM, code: "mg", display: "milligram" },
  { system: UCUM_SYSTEM, code: "g", display: "gram" },
  { system: UCUM_SYSTEM, code: "ug", display: "microgram" },
  { system: UCUM_SYSTEM, code: "L", display: "liter" },
  { system: UCUM_SYSTEM, code: "[iU]", display: "international unit" },
  { system: UCUM_SYSTEM, code: "{count}", display: "count" },
  { system: UCUM_SYSTEM, code: "[drp]", display: "drop" },
  { system: UCUM_SYSTEM, code: "mg/mL", display: "milligram per milliliter" },
] as const;

// ─── Required & Optional Headers ───────────────────────────────────
export const PK_REQUIRED_HEADERS = [
  "resourceCategory",
  "slug",
  "name",
  "productType",
  "baseUnitDisplay",
] as const;

export const PK_OPTIONAL_HEADERS = [
  "codeDisplay",
  "codeValue",
  "dosageFormDisplay",
  "dosageFormCode",
  "routeCode",
  "routeDisplay",
  "alternateIdentifier",
  "alternateNameType",
  "alternateNameValue",
] as const;

export const PK_ALL_HEADERS = [
  ...PK_REQUIRED_HEADERS,
  ...PK_OPTIONAL_HEADERS,
] as const;

// ─── Header Mapping (normalized → canonical) ───────────────────────
export const PK_HEADER_MAP: Record<string, string> = PK_ALL_HEADERS.reduce(
  (acc, header) => {
    acc[normalizeHeader(header)] = header;
    return acc;
  },
  {} as Record<string, string>,
);

// ─── Zod Schema ────────────────────────────────────────────────────
export const ProductKnowledgeRowSchema = z.object({
  // Required fields
  resourceCategory: z.string().min(1, "Resource category is required"),
  slug: SlugSchema,
  name: z.string().min(1, "Name is required"),
  productType: z
    .string()
    .min(1, "Product type is required")
    .transform((val) => val.toLowerCase().trim())
    .pipe(ProductKnowledgeTypeSchema),
  baseUnitDisplay: z
    .string()
    .min(1, "Base unit is required")
    .refine(
      (display) =>
        DOSAGE_UNITS_CODES.some(
          (u) => u.display.toLowerCase() === display.toLowerCase(),
        ),
      (display) => ({
        message: `Could not resolve base unit for '${display}'. Valid units: ${DOSAGE_UNITS_CODES.map((u) => u.display).join(", ")}`,
      }),
    ),

  // Optional fields
  codeDisplay: z.string().optional(),
  codeValue: z.string().optional(),
  dosageFormDisplay: z.string().optional(),
  dosageFormCode: z.string().optional(),
  routeCode: z.string().optional(),
  routeDisplay: z.string().optional(),
  alternateIdentifier: z.string().optional(),
  alternateNameType: z
    .string()
    .optional()
    .transform((val) =>
      val?.trim() ? val.toLowerCase().replace(/\s+/g, "_") : undefined,
    )
    .pipe(ProductNameTypeSchema.optional()),
  alternateNameValue: z.string().optional(),
});

export type ProductKnowledgeRow = z.infer<typeof ProductKnowledgeRowSchema>;

// ─── Helpers ───────────────────────────────────────────────────────
function parseCsvList(value: string): string[] {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function resolveBaseUnit(display: string) {
  const unit = DOSAGE_UNITS_CODES.find(
    (u) => u.display.toLowerCase() === display.toLowerCase(),
  );
  if (!unit) {
    throw new Error(`Could not resolve base unit for '${display}'`);
  }
  return { system: unit.system, code: unit.code, display: unit.display };
}

// ─── API Payload Transformer ───────────────────────────────────────
export interface ProductKnowledgeCreatePayload {
  slug_value: string;
  name: string;
  facility: string;
  product_type: ProductKnowledgeType;
  status: ProductKnowledgeStatus;
  base_unit: { system: string; code: string; display: string };
  category: string;
  names: { name_type: ProductNameType; name: string }[];
  storage_guidelines: unknown[];
  is_instance_level: boolean;
  code?: { system: string; code: string; display: string };
  definitional?: {
    dosage_form?: { system: string; code: string; display: string };
    intended_routes: { system: string; code: string; display: string }[];
    ingredients: unknown[];
    nutrients: unknown[];
    drug_characteristic: unknown[];
  };
  alternate_identifier?: string;
}

export function toProductKnowledgeCreatePayload(
  row: ProductKnowledgeRow,
  facilityId: string,
  categorySlug: string,
): ProductKnowledgeCreatePayload {
  const baseUnit = resolveBaseUnit(row.baseUnitDisplay);

  const payload: ProductKnowledgeCreatePayload = {
    slug_value: row.slug,
    name: row.name.trim(),
    facility: facilityId,
    product_type: row.productType,
    status: "active",
    base_unit: baseUnit,
    category: categorySlug,
    names: [],
    storage_guidelines: [],
    is_instance_level: false,
  };

  // Code (SNOMED)
  const codeValue = row.codeValue?.trim();
  const codeDisplay = row.codeDisplay?.trim();
  if (codeValue) {
    payload.code = {
      system: SNOMED_SYSTEM,
      code: codeValue,
      display: codeDisplay || codeValue,
    };
  }

  // Dosage form & routes (definitional)
  const dosageFormCode = row.dosageFormCode?.trim();
  const dosageFormDisplay = row.dosageFormDisplay?.trim();
  const routeCodes = parseCsvList(row.routeCode || "");
  const routeDisplays = parseCsvList(row.routeDisplay || "");

  if (dosageFormCode || routeCodes.length > 0) {
    const intendedRoutes = routeCodes.map((code, index) => ({
      system: SNOMED_SYSTEM,
      code,
      display: routeDisplays[index] || routeDisplays[0] || code,
    }));

    payload.definitional = {
      intended_routes: intendedRoutes,
      ingredients: [],
      nutrients: [],
      drug_characteristic: [],
    };

    if (dosageFormCode) {
      payload.definitional.dosage_form = {
        system: SNOMED_SYSTEM,
        code: dosageFormCode,
        display: dosageFormDisplay || dosageFormCode,
      };
    }
  }

  // Alternate identifier
  if (row.alternateIdentifier?.trim()) {
    payload.alternate_identifier = row.alternateIdentifier.trim();
  }

  // Alternate name
  const alternateNameValue = row.alternateNameValue?.trim();
  if (row.alternateNameType && alternateNameValue) {
    payload.names = [
      { name_type: row.alternateNameType, name: alternateNameValue },
    ];
  }

  return payload;
}

// ─── Validation Helpers ────────────────────────────────────────────

/**
 * Validates that the base unit can be resolved.
 * Call this during row validation to provide early feedback.
 */
export function validateBaseUnit(display: string): string | null {
  const unit = DOSAGE_UNITS_CODES.find(
    (u) => u.display.toLowerCase() === display.toLowerCase(),
  );
  if (!unit) {
    return `Could not resolve base unit for '${display}'. Valid units: ${DOSAGE_UNITS_CODES.map((u) => u.display).join(", ")}`;
  }
  return null;
}

/**
 * Cross-row validation: detect duplicate slugs.
 */
export function validateProductKnowledgeRows(
  rows: ProductKnowledgeRow[],
): { identifier: string; reason: string }[] {
  const errors: { identifier: string; reason: string }[] = [];
  const slugSeen = new Map<string, number>();

  rows.forEach((row, index) => {
    const slug = row.slug;
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

// ─── Row Parser ────────────────────────────────────────────────────
export function parseProductKnowledgeRow(
  row: string[],
  headerIndices: Record<string, number>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const header of PK_ALL_HEADERS) {
    const idx = headerIndices[header];
    result[header] = idx !== undefined ? (row[idx]?.trim() ?? "") : "";
  }

  return result;
}

// ─── Sample CSV ─────────────────────────────────────────────────────
export const PK_SAMPLE_CSV = {
  headers: [
    "resourceCategory",
    "slug",
    "name",
    "productType",
    "codeDisplay",
    "codeValue",
    "baseUnitDisplay",
    "dosageFormDisplay",
    "dosageFormCode",
    "routeCode",
    "routeDisplay",
    "alternateIdentifier",
    "alternateNameType",
    "alternateNameValue",
  ],
  rows: [
    [
      "Medication",
      "isoflurane-inhaler",
      "Isoflurane inhaler",
      "medication",
      "Product containing precisely isoflurane",
      "784978007",
      "milligram per milliliter",
      "solution for inhalation",
      "420641004",
      "447694001",
      "Respiratory tract route",
      "",
      "",
      "",
    ],
  ],
};
