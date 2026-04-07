import { z } from "zod";

// ─── Slug Validation ───────────────────────────────────────────────
export const slugRegex = /^[a-z0-9_-]+$/;

export const SlugSchema = z
  .string()
  .min(1, "Slug is required")
  .regex(
    slugRegex,
    "Slug must contain only lowercase letters, numbers, hyphens, and underscores",
  );

// ─── Status Enums ──────────────────────────────────────────────────
export const ResourceStatusSchema = z.enum([
  "draft",
  "active",
  "retired",
  "unknown",
]);
export type ResourceStatus = z.infer<typeof ResourceStatusSchema>;

// ─── Code Schema (system, code, display) ───────────────────────────
export const CodeSchema = z.object({
  system: z.string().min(1, "System is required"),
  code: z.string().min(1, "Code is required"),
  display: z.string().min(1, "Display is required"),
});

// ─── Decimal String ────────────────────────────────────────────────
/** Validates a string representing a decimal number (e.g. "5.00", "1", "0.5"). */
export const zodDecimal = () =>
  z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid decimal number");

// ─── Import Results (shared across all imports) ────────────────────
export interface ImportResults {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: ImportFailure[];
}

export interface ImportFailure {
  rowIndex: number;
  identifier?: string;
  reason: string;
}

export const createEmptyResults = (): ImportResults => ({
  processed: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
});

// ─── Validation Helper ─────────────────────────────────────────────
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

export function validateRow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

// ─── Header Normalization ──────────────────────────────────────────
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildHeaderMap(
  headers: string[],
  headerMapping: Record<string, string>,
): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = normalizeHeader(h);
    const canonical = headerMapping[normalized];
    if (canonical) {
      map[canonical] = i;
    }
  });
  return map;
}
