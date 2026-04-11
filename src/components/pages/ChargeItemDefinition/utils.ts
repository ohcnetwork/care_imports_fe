import { z } from "zod";

import type { ChargeItemDefinitionCreate } from "@/types/billing/chargeItemDefinition/chargeItemDefinition";
import { ChargeItemDefinitionStatus } from "@/types/billing/chargeItemDefinition/chargeItemDefinition";

import { normalizeHeader } from "../../../types/common";

// ─── Required Headers ──────────────────────────────────────────────
export const CHARGE_ITEM_REQUIRED_HEADERS = [
  "title",
  "slug_value",
  "price",
] as const;

export const CHARGE_ITEM_OPTIONAL_HEADERS = [
  "description",
  "purpose",
  "status",
  "derived_from_uri",
  "version",
  "can_edit_charge_item",
] as const;

// ─── Status Enum ───────────────────────────────────────────────────

// ─── Header Mapping ────────────────────────────────────────────────
export const CHARGE_ITEM_HEADER_MAP: Record<string, string> = [
  ...CHARGE_ITEM_REQUIRED_HEADERS,
  ...CHARGE_ITEM_OPTIONAL_HEADERS,
].reduce(
  (acc, header) => {
    acc[normalizeHeader(header)] = header;
    return acc;
  },
  {} as Record<string, string>,
);

// ─── Zod Schema ────────────────────────────────────────────────────
const slugValueRegex = /^[a-z0-9_-]+$/;

export const ChargeItemRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug_value: z
    .string()
    .min(1, "Slug is required")
    .regex(
      slugValueRegex,
      "Slug must contain only lowercase letters, digits, hyphens, and underscores",
    ),
  description: z.string().optional(),
  purpose: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  status: z.nativeEnum(ChargeItemDefinitionStatus).optional(),
  derived_from_uri: z.string().optional(),
  version: z.number().int().positive().optional(),
  can_edit_charge_item: z.boolean().optional(),
});

export type ChargeItemRow = z.infer<typeof ChargeItemRowSchema>;

// ─── Cross-Row Validation ──────────────────────────────────────────
export function validateChargeItemRows(
  rows: ChargeItemRow[],
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

// ─── API Payload ───────────────────────────────────────────────────
export function toChargeItemCreatePayload(
  row: ChargeItemRow,
  categorySlug: string,
): ChargeItemDefinitionCreate {
  return {
    title: row.title.trim(),
    slug_value: row.slug_value.trim(),
    status: row.status ?? ChargeItemDefinitionStatus.active,
    category: categorySlug,
    description: row.description?.trim() || "",
    purpose: row.purpose?.trim() || "",
    can_edit_charge_item: row.can_edit_charge_item ?? true,
    discount_configuration: null,
    price_components: [
      {
        monetary_component_type: "base",
        amount: row.price.trim(),
      },
    ],
    ...(row.derived_from_uri?.trim() && {
      derived_from_uri: row.derived_from_uri.trim(),
    }),
    ...(row.version != null && { version: row.version }),
  };
}

// ─── Sample CSV ────────────────────────────────────────────────────
export const CHARGE_ITEM_SAMPLE_CSV = {
  headers: [
    "title",
    "slug_value",
    "description",
    "purpose",
    "price",
    "status",
    "derived_from_uri",
    "version",
    "can_edit_charge_item",
  ],
  rows: [
    [
      "Consultation Fee",
      "consultation-fee",
      "Doctor consultation fee",
      "Consultation charge",
      "250",
      "",
      "",
      "",
      "",
    ],
    [
      "Bed Charges",
      "bed-charges",
      "Per day bed charge",
      "Bed usage",
      "1500",
      "draft",
      "",
      "1",
      "false",
    ],
  ],
};

// ─── Parse Row ─────────────────────────────────────────────────────
export function parseChargeItemRow(
  row: string[],
  headerIndices: Record<string, number>,
): Record<string, unknown> {
  const get = (key: string) => row[headerIndices[key]]?.trim() ?? "";

  const versionStr = get("version");
  const version = versionStr ? Number.parseInt(versionStr, 10) : undefined;

  const canEditStr = get("can_edit_charge_item").toLowerCase();
  const canEditChargeItem =
    canEditStr === "true" ? true : canEditStr === "false" ? false : undefined;

  return {
    title: get("title"),
    slug_value: get("slug_value"),
    description: get("description") || undefined,
    purpose: get("purpose") || undefined,
    price: get("price"),
    status: get("status") || undefined,
    derived_from_uri: get("derived_from_uri") || undefined,
    version: version && !Number.isNaN(version) ? version : undefined,
    can_edit_charge_item: canEditChargeItem,
  };
}
