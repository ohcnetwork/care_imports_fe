import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type {
  ObservationDefinitionComponentSpec,
  ObservationProcessedRow,
} from "@/types/emr/observationDefinition/observationDefinition";
import {
  formatComponentRanges,
  getComponentUnit,
} from "@/Utils/formatComponentRanges";

interface ObservationDefinitionReviewTableProps {
  processedRows: ObservationProcessedRow[];
  /** When provided, enables per-row selection checkboxes (used by master import). */
  selectable?: boolean;
  selectedRowIds?: Set<number>;
  onSelectedRowIdsChange?: (ids: Set<number>) => void;
}

export default function ObservationDefinitionReviewTable({
  processedRows,
  selectable = false,
  selectedRowIds,
  onSelectedRowIdsChange,
}: ObservationDefinitionReviewTableProps) {
  const [expandedRow, setExpandedRow] = useState<string>("");

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="max-h-[32rem] overflow-auto">
        {/* Header row */}
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className="px-4 py-2 text-left w-12">Select</th>
              )}
              <th className="px-4 py-2 text-left w-8" />
              <th className="px-4 py-2 text-left">Row</th>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Issues</th>
            </tr>
          </thead>
        </table>

        {/* Accordion body */}
        <Accordion
          type="single"
          collapsible
          value={expandedRow}
          onValueChange={setExpandedRow}
        >
          {processedRows.map((row) => {
            const hasComponents = row.data.component.length > 0;
            const isValid = row.errors.length === 0;
            const rowKey = String(row.rowIndex);

            return (
              <AccordionItem
                key={row.rowIndex}
                value={rowKey}
                className={
                  isValid
                    ? "border-t border-gray-100"
                    : "border-t border-gray-100 bg-gray-50 text-gray-400"
                }
              >
                {/* Trigger row — mirrors the table columns */}
                <div className="flex items-center min-w-full text-sm">
                  {selectable && (
                    <div className="px-4 py-2 w-12 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedRowIds?.has(row.rowIndex) ?? false}
                        onChange={(event) => {
                          if (!isValid || !onSelectedRowIdsChange) return;
                          const next = new Set(selectedRowIds);
                          if (event.target.checked) {
                            next.add(row.rowIndex);
                          } else {
                            next.delete(row.rowIndex);
                          }
                          onSelectedRowIdsChange(next);
                        }}
                        disabled={!isValid}
                      />
                    </div>
                  )}
                  <div className="px-4 py-2 w-8 shrink-0">
                    {hasComponents ? (
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <span className="sr-only">Toggle components</span>
                      </AccordionTrigger>
                    ) : (
                      <span className="inline-block w-4" />
                    )}
                  </div>
                  <div className="px-4 py-2 flex-1 flex items-center gap-0 min-w-0">
                    <span className="w-16 shrink-0 text-gray-500">
                      {row.rowIndex}
                    </span>
                    <span className="w-48 shrink-0 truncate">
                      {row.data.title}
                    </span>
                    <span className="w-32 shrink-0">{row.data.category}</span>
                    <span className="w-24 shrink-0">
                      {isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Valid
                        </span>
                      ) : (
                        <span className="text-red-600">Invalid</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-600 truncate">
                      {row.errors.length > 0 ? row.errors.join("; ") : "-"}
                    </span>
                  </div>
                </div>

                {/* Expanded content: components sub-table */}
                {hasComponents && (
                  <AccordionContent className="px-4 pb-4">
                    <ComponentsSubTable components={row.data.component} />
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Components sub-table                                               */
/* ------------------------------------------------------------------ */

function ComponentsSubTable({
  components,
}: {
  components: ObservationDefinitionComponentSpec[];
}) {
  return (
    <div className="ml-8 mt-2">
      <p className="text-xs font-semibold text-gray-500 mb-2">
        Observation Components ({components.length})
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">Component Name</th>
              <th className="px-4 py-2 text-left">Data Type</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Reference Range</th>
            </tr>
          </thead>
          <tbody>
            {components.map((comp, idx) => {
              const rangeLines = formatComponentRanges(comp.qualified_ranges);
              const unit = getComponentUnit(comp);

              return (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="px-4 py-2">{comp.code?.display ?? "-"}</td>
                  <td className="px-4 py-2">
                    {comp.permitted_data_type ? (
                      <Badge variant="outline">
                        {comp.permitted_data_type}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {comp.code?.code ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {rangeLines.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {rangeLines.map((line, i) => (
                          <span key={i}>
                            {line}
                            {unit ? ` ${unit}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
