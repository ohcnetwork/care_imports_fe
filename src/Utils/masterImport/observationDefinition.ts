import type { Code } from "@/types/base/code/code";

import type { Condition } from "@/types/base/condition/condition";
import { ConditionOperation } from "@/types/base/condition/condition";
import type {
  NumericRange,
  QualifiedRange,
} from "@/types/base/qualifiedRange/qualifiedRange";
import { InterpretationType } from "@/types/base/qualifiedRange/qualifiedRange";
import type { ObservationDefinitionComponentCreateSpec } from "@/types/emr/observationDefinition/observationDefinition";
import { QuestionType } from "@/types/emr/observationDefinition/observationDefinition";
import { parseCsvText } from "@/Utils/csv";

const REQUIRED_HEADERS = [
  "title",
  "description",
  "category",
  "permitted_data_type",
  "code_system",
  "code_value",
  "code_display",
] as const;

const COMPONENT_REQUIRED_HEADERS = [
  "observation_slug",
  "code_value",
  "code_display",
] as const;

const QUESTION_TYPES = [
  "boolean",
  "decimal",
  "integer",
  "dateTime",
  "time",
  "string",
  "quantity",
] as const;

const VALID_GENDERS = ["male", "female", "transgender", "non_binary"] as const;

const VALID_AGE_OPS = ["years", "months", "days"] as const;

const normalizeHeader = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9_]/g, "");

const getCellValue = (
  row: string[],
  headerMap: Record<string, number>,
  key: string,
) => {
  const index = headerMap[normalizeHeader(key)];
  return index === undefined ? "" : (row[index] ?? "");
};

/* ------------------------------------------------------------------ */
/*  Components CSV parser                                              */
/* ------------------------------------------------------------------ */

/**
 * Build a composite key for grouping component CSV rows into
 * qualified_range sets.  Rows sharing the same condition key
 * (slug + code_value + age/gender conditions) produce range bands
 * within a single qualified_range.
 */
const buildConditionKey = (
  ageMin: string,
  ageMax: string,
  ageOp: string,
  gender: string,
): string => [ageMin, ageMax, ageOp, gender].join("|");

/**
 * Parse a components CSV string and return a map of
 *   observation_slug → ObservationDefinitionComponentCreateSpec[]
 *
 * Grouping logic:
 *  1. (observation_slug, code_value) → one component
 *  2. Within a component, (age_min, age_max, age_op, gender) → one qualified_range
 *  3. Each CSV row adds one range band to that qualified_range
 */
export const parseComponentCsv = (
  csvText: string,
): {
  componentMap: Map<string, ObservationDefinitionComponentCreateSpec[]>;
  errors: { csvRow: number; message: string }[];
} => {
  const { headers, rows } = parseCsvText(csvText);
  const errors: { csvRow: number; message: string }[] = [];

  if (headers.length === 0) {
    return {
      componentMap: new Map(),
      errors: [
        { csvRow: 0, message: "Components CSV is empty or missing headers" },
      ],
    };
  }

  const headerMap = headers.reduce<Record<string, number>>(
    (acc, header, index) => {
      acc[normalizeHeader(header)] = index;
      return acc;
    },
    {},
  );

  const missingHeaders = COMPONENT_REQUIRED_HEADERS.filter(
    (h) => headerMap[normalizeHeader(h)] === undefined,
  );
  if (missingHeaders.length > 0) {
    return {
      componentMap: new Map(),
      errors: [
        {
          csvRow: 0,
          message: `Components CSV missing required headers: ${missingHeaders.join(", ")}`,
        },
      ],
    };
  }

  // Intermediate structure for grouping:
  //   slug → code_value → { component fields, conditionKey → rangeBands[] }
  type RangeBand = {
    display: string;
    min: string;
    max: string;
    csvRow: number;
  };
  type InterpGroup = {
    ageMin: string;
    ageMax: string;
    ageOp: string;
    gender: string;
    bands: RangeBand[];
  };
  type ComponentGroup = {
    code: Code;
    permitted_data_type: QuestionType;
    permitted_unit: Code | null;
    interpretations: Map<string, InterpGroup>;
  };

  const slugMap = new Map<string, Map<string, ComponentGroup>>();

  rows.forEach((row, idx) => {
    const csvRow = idx + 2; // 1-based, +1 for header
    const get = (key: string) => getCellValue(row, headerMap, key).trim();

    const slug = get("observation_slug");
    const codeSystem = get("code_system") || "http://loinc.org";
    const codeValue = get("code_value");
    const codeDisplay = get("code_display");
    const permittedDataType = get("permitted_data_type");
    const unitSystem = get("unit_system") || "http://unitsofmeasure.org";
    const unitCode = get("unit_code");
    const unitDisplay = get("unit_display");
    const ageMin = get("age_min");
    const ageMax = get("age_max");
    const ageOp = get("age_op");
    const gender = get("gender");
    const rangeDisplay = get("range_display");
    const rangeMin = get("range_min");
    const rangeMax = get("range_max");

    // Row-level validation
    if (!slug) {
      errors.push({ csvRow, message: "Missing observation_slug" });
      return;
    }
    if (!codeValue || !codeDisplay) {
      errors.push({ csvRow, message: "Missing code_value or code_display" });
      return;
    }
    if (
      permittedDataType &&
      !QUESTION_TYPES.includes(permittedDataType as never)
    ) {
      errors.push({
        csvRow,
        message: `Invalid permitted_data_type "${permittedDataType}"`,
      });
      return;
    }
    if ((unitCode || unitDisplay) && !(unitCode && unitDisplay)) {
      errors.push({
        csvRow,
        message: "Permitted unit requires both unit_code and unit_display",
      });
      return;
    }
    if ((ageMin || ageMax) && !ageOp) {
      errors.push({
        csvRow,
        message: "age_op is required when age_min/age_max is set",
      });
      return;
    }
    if (ageOp && !VALID_AGE_OPS.includes(ageOp.toLowerCase() as never)) {
      errors.push({
        csvRow,
        message: `Invalid age_op "${ageOp}" (must be years/months/days)`,
      });
      return;
    }
    if (gender && !VALID_GENDERS.includes(gender.toLowerCase() as never)) {
      errors.push({
        csvRow,
        message: `Invalid gender "${gender}" (must be male/female/transgender/non_binary)`,
      });
      return;
    }
    // Validate range data only when range_display is provided
    if (rangeDisplay) {
      if (rangeMin && rangeMax && Number(rangeMin) > Number(rangeMax)) {
        errors.push({ csvRow, message: "Range min must be ≤ max" });
        return;
      }
    }

    // Group into structure
    if (!slugMap.has(slug)) {
      slugMap.set(slug, new Map());
    }
    const componentMap = slugMap.get(slug)!;

    if (!componentMap.has(codeValue)) {
      componentMap.set(codeValue, {
        code: { system: codeSystem, code: codeValue, display: codeDisplay },
        permitted_data_type: permittedDataType as QuestionType,
        permitted_unit:
          unitCode && unitDisplay
            ? { system: unitSystem, code: unitCode, display: unitDisplay }
            : null,
        interpretations: new Map(),
      });
    }
    const comp = componentMap.get(codeValue)!;

    const condKey = buildConditionKey(ageMin, ageMax, ageOp, gender);
    if (!comp.interpretations.has(condKey)) {
      comp.interpretations.set(condKey, {
        ageMin,
        ageMax,
        ageOp: ageOp.toLowerCase(),
        gender: gender.toLowerCase(),
        bands: [],
      });
    }
    // Only add a range band if range_display is provided
    if (rangeDisplay) {
      comp.interpretations.get(condKey)!.bands.push({
        display: rangeDisplay,
        min: rangeMin,
        max: rangeMax,
        csvRow,
      });
    }
  });

  // Convert grouped structure → Map<slug, ObservationDefinitionComponentCreateSpec[]>
  const resultMap = new Map<
    string,
    ObservationDefinitionComponentCreateSpec[]
  >();

  for (const [slug, componentGroups] of slugMap) {
    const components: ObservationDefinitionComponentCreateSpec[] = [];

    for (const comp of componentGroups.values()) {
      // Build qualified_ranges from interpretation groups
      const qualifiedRanges: QualifiedRange[] = [];

      for (const interp of comp.interpretations.values()) {
        // Skip interpretation groups with no range bands
        if (interp.bands.length === 0) continue;

        const conditions: Condition[] = [];

        if (interp.ageMin || interp.ageMax) {
          conditions.push({
            metric: "patient_age",
            operation: ConditionOperation.in_range,
            value: {
              min: Number(interp.ageMin) || 0,
              max: Number(interp.ageMax) || 0,
              value_type: interp.ageOp || "years",
            },
          });
        }
        if (interp.gender) {
          conditions.push({
            metric: "patient_gender",
            operation: ConditionOperation.equality,
            value: interp.gender,
          });
        }

        const rangeBands: NumericRange[] = interp.bands.map((b) => ({
          interpretation: { display: b.display },
          ...(b.min ? { min: b.min } : {}),
          ...(b.max ? { max: b.max } : {}),
        }));

        const qr: QualifiedRange = {
          ranges: rangeBands,
          _interpretation_type: InterpretationType.ranges,
          ...(conditions.length > 0 ? { conditions } : {}),
        };
        qualifiedRanges.push(qr);
      }

      components.push({
        code: comp.code,
        permitted_data_type: comp.permitted_data_type,
        permitted_unit: comp.permitted_unit,
        qualified_ranges: qualifiedRanges,
      });
    }

    resultMap.set(slug, components);
  }

  return { componentMap: resultMap, errors };
};
