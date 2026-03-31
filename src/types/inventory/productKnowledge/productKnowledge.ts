export enum ProductKnowledgeStatus {
  active = "active",
}

export enum ProductKnowledgeType {
  consumable = "consumable",
  medication = "medication",
  nutritional_product = "nutritional_product",
}

export enum ProductNameTypes {
  trade_name = "trade_name",
  alias = "alias",
  original_name = "original_name",
  preferred = "preferred",
}

export interface ProductKnowledgeBase {
  slug_config: { slug_value: string };
}

export interface ProductKnowledgeCreate {
  slug_value: string;
  name: string;
  facility: string;
  product_type: ProductKnowledgeType;
  status: ProductKnowledgeStatus;
  base_unit: { system: string; code: string; display: string };
  category: string;
  names: { name_type: ProductNameTypes; name: string }[];
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

/* ------------------------------------------------------------------ */
/*  CSV Import Types                                                   */
/* ------------------------------------------------------------------ */

export type ProductKnowledgeCsvHeaderKey =
  | "resourceCategory"
  | "slug"
  | "name"
  | "productType"
  | "codeDisplay"
  | "codeValue"
  | "baseUnitDisplay"
  | "dosageFormDisplay"
  | "dosageFormCode"
  | "routeCode"
  | "routeDisplay"
  | "alternateIdentifier"
  | "alternateNameType"
  | "alternateNameValue";

export type ProductKnowledgeCsvRow = Record<
  ProductKnowledgeCsvHeaderKey,
  string
>;

export type ProductKnowledgeValidated = Omit<
  ProductKnowledgeCsvRow,
  "productType" | "alternateNameType"
> & {
  baseUnit: { system: string; code: string; display: string };
  slugPromise: Promise<string>;
  productType: ProductKnowledgeType;
  alternateNameType?: ProductNameTypes;
  dosageForm?: { system: string; code: string; display: string };
  intendedRoutes: { system: string; code: string; display: string }[];
  code?: { system: string; code: string; display: string };
};

export type ProductKnowledgeProcessedRow = {
  rowIndex: number;
  raw: ProductKnowledgeCsvRow;
  errors: string[];
  normalized: ProductKnowledgeValidated | null;
};
