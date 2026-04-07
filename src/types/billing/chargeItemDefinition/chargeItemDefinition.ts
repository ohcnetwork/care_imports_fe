import type { MonetaryComponent } from "@/types/base/monetaryComponent/monetaryComponent";
import type { ResourceCategoryRead } from "@/types/base/resourceCategory/resourceCategory";
import type { SlugConfig } from "@/types/base/slug/slugConfig";

export enum ChargeItemDefinitionStatus {
  draft = "draft",
  active = "active",
  retired = "retired",
}

export interface ChargeItemDefinitionBase {
  id: string;
  status: ChargeItemDefinitionStatus;
  title: string;
  slug: string;
  derived_from_uri?: string;
  description?: string;
  purpose?: string;
  price_components: MonetaryComponent[];
  category: ResourceCategoryRead;
  slug_config: SlugConfig;
  can_edit_charge_item: boolean;
}

export interface ChargeItemDefinitionRead extends ChargeItemDefinitionBase {
  version?: number;
  category: ResourceCategoryRead;
}

export interface ChargeItemDefinitionCreate
  extends Omit<
    ChargeItemDefinitionBase,
    "id" | "category" | "slug_config" | "slug"
  > {
  slug_value: string;
  category: string;
  version?: number;
  discount_configuration: null;
}
