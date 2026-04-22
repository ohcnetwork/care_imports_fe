import ExportCard from "@/components/shared/ExportCard";
import type { ProductKnowledgeBase } from "@/types/inventory/productKnowledge/productKnowledge";
import productKnowledgeApi from "@/types/inventory/productKnowledge/productKnowledgeApi";
import { stripFacilitySlugPrefix } from "@/Utils/export";

interface ProductKnowledgeExportProps {
  facilityId?: string;
}

const CSV_HEADERS = [
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
];

export default function ProductKnowledgeExport({
  facilityId,
}: ProductKnowledgeExportProps) {
  if (!facilityId) return null;

  return (
    <ExportCard<ProductKnowledgeBase>
      title="Export Product Knowledge"
      description="Export all product knowledge as a CSV file matching the import format."
      queryKey={["product-knowledge", facilityId]}
      route={productKnowledgeApi.listProductKnowledge}
      queryParams={{ facility: facilityId }}
      csvHeaders={CSV_HEADERS}
      mapRow={(item) => {
        const slug = stripFacilitySlugPrefix(
          item.slug_config?.slug_value ?? item.slug ?? "",
        );
        const routes = item.definitional?.intended_routes ?? [];
        const routeCodes = routes.map((r) => r.code ?? "").join(",");
        const routeDisplays = routes.map((r) => r.display ?? "").join(",");

        const altName = item.names?.[0];

        return [
          item.category?.title ?? "",
          slug,
          item.name ?? "",
          item.product_type ?? "",
          item.code?.display ?? "",
          item.code?.code ?? "",
          item.base_unit?.display ?? "",
          item.definitional?.dosage_form?.display ?? "",
          item.definitional?.dosage_form?.code ?? "",
          routeCodes,
          routeDisplays,
          item.alternate_identifier ?? "",
          altName?.name_type ?? "",
          altName?.name ?? "",
        ];
      }}
      filename={`product_knowledge_export_${facilityId}.csv`}
      enabled={Boolean(facilityId)}
    />
  );
}
