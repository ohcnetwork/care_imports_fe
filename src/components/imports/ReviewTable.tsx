import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProcessedRow, ReviewColumn } from "@/types/importConfig";
import { useCallback, useMemo } from "react";

export interface ReviewTableProps<TRow> {
  /** Processed rows to display */
  rows: ProcessedRow<TRow>[];

  /** Column definitions */
  columns: ReviewColumn<TRow>[];

  /** Resource name for display */
  resourceName: string;

  /** Called when user clicks "Start Import" with selected row indices */
  onStartImport: (selectedRowIndices: Set<number>) => void;

  /** Called when user clicks "Back" */
  onBack: () => void;

  /** Whether the import button should be disabled */
  importDisabled?: boolean;

  /** Label for the continue/import button */
  continueLabel?: string;
}

export function ReviewTable<TRow>({
  rows,
  columns,
  resourceName,
  onStartImport,
  onBack,
  importDisabled = false,
  continueLabel,
}: ReviewTableProps<TRow>) {
  const validRowIds = useMemo(
    () =>
      rows.filter((row) => row.errors.length === 0).map((row) => row.rowIndex),
    [rows],
  );
  const validCount = validRowIds.length;
  const invalidCount = rows.length - validCount;

  const handleStartImport = useCallback(() => {
    onStartImport(new Set(validRowIds));
  }, [onStartImport, validRowIds]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review {resourceName}</CardTitle>
        <CardDescription>
          {
            "Validate data before importing. All rows need to be valid to proceed."
          }
        </CardDescription>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            {validCount} valid
          </Badge>
          {invalidCount > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700">
              {invalidCount} invalid
            </Badge>
          )}
          <Badge variant="outline" className="bg-gray-50 text-gray-600">
            {rows.length} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left w-16">Row</th>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={`px-4 py-2 text-left ${col.width ?? ""}`}
                    >
                      {col.header}
                    </th>
                  ))}
                  {invalidCount > 0 && (
                    <th className="px-4 py-2 text-left">Errors</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isValid = row.errors.length === 0;
                  return (
                    <tr
                      key={row.rowIndex}
                      className={`border-t border-gray-100 ${
                        !isValid && "bg-red-50/50"
                      }`}
                    >
                      <td className="px-4 py-2 text-gray-500">
                        {row.rowIndex}
                      </td>
                      {columns.map((col, i) => (
                        <td key={i} className="px-4 py-2">
                          {row.data
                            ? typeof col.accessor === "function"
                              ? (col.accessor(row.data) ?? "—")
                              : ((row.data[col.accessor] as string) ?? "—")
                            : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        {isValid ? (
                          <span className="text-green-600 text-sm">Valid</span>
                        ) : (
                          <span
                            className="text-red-600 text-sm"
                            title={row.errors.join("\n")}
                          >
                            {row.errors.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={handleStartImport}
            disabled={importDisabled || invalidCount > 0}
          >
            {continueLabel ??
              `Import ${validCount} ${validCount === 1 ? resourceName : `${resourceName}s`}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
