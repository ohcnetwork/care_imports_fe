import { useMemo, useState } from "react";

import { APIError, apis } from "@/apis";
import ObservationDefinitionReviewTable from "@/components/shared/ObservationDefinitionReviewTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ObservationProcessedRow } from "@/types/emr/observationDefinition/observationDefinition";
import { type ImportResults } from "@/utils/importHelpers";
import { parseObservationDefinitionCsv } from "@/utils/masterImport/observationDefinition";

interface ObservationDefinitionCsvImportProps {
  facilityId?: string;
  defsCsvText: string;
  compCsvText: string;
  onBack: () => void;
}

export default function ObservationDefinitionCsvImport({
  facilityId,
  defsCsvText,
  compCsvText,
  onBack,
}: ObservationDefinitionCsvImportProps) {
  const [currentStep, setCurrentStep] = useState<
    "review" | "importing" | "done"
  >("review");
  const [processedRows] = useState<ObservationProcessedRow[]>(() =>
    parseObservationDefinitionCsv(defsCsvText, compCsvText),
  );
  const [results, setResults] = useState<ImportResults | null>(null);
  const [totalToImport, setTotalToImport] = useState(0);

  const summary = useMemo(() => {
    const valid = processedRows.filter((row) => row.errors.length === 0).length;
    const invalid = processedRows.length - valid;
    return { total: processedRows.length, valid, invalid };
  }, [processedRows]);

  const validRows = useMemo(
    () => processedRows.filter((row) => row.errors.length === 0),
    [processedRows],
  );

  const runImport = async () => {
    if (!facilityId) return;

    setTotalToImport(validRows.length);

    if (validRows.length === 0) {
      setResults({
        processed: 0,
        created: 0,
        updated: 0,
        failed: 0,
        skipped: summary.invalid,
        failures: [],
      });
      setCurrentStep("done");
      return;
    }

    setCurrentStep("importing");
    setResults({
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      skipped: summary.invalid,
      failures: [],
    });

    for (const row of validRows) {
      try {
        const slug = row.data.slug_value;
        const payload = {
          slug_value: slug,
          title: row.data.title,
          status: row.data.status,
          description: row.data.description,
          category: row.data.category,
          code: row.data.code,
          permitted_data_type: row.data.permitted_data_type,
          component: row.data.component,
          body_site: row.data.body_site,
          method: row.data.method,
          permitted_unit: row.data.permitted_unit,
          derived_from_uri: row.data.derived_from_uri || undefined,
          facility: facilityId,
          qualified_ranges: row.data.qualified_ranges ?? [],
        };

        const detailSlug = `f-${facilityId}-${slug}`;
        let existingId: string | undefined;
        try {
          const existing =
            await apis.facility.observationDefinition.get(detailSlug);
          existingId = (existing as { id?: string }).id;
        } catch (error) {
          if (error instanceof APIError && error.status === 404) {
            existingId = undefined;
          } else {
            throw error;
          }
        }
        const datapoint = existingId ? { ...payload, id: detailSlug } : payload;

        await apis.facility.observationDefinition.upsert({
          datapoints: [datapoint as unknown as Record<string, unknown>],
        });

        setResults((prev) =>
          prev
            ? {
                ...prev,
                processed: prev.processed + 1,
                created: prev.created + 1,
              }
            : prev,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown error";
        setResults((prev) =>
          prev
            ? {
                ...prev,
                processed: prev.processed + 1,
                failed: prev.failed + 1,
                failures: [
                  ...prev.failures,
                  { rowIndex: row.rowIndex, title: row.data.title, reason },
                ],
              }
            : prev,
        );
      }
    }

    setCurrentStep("done");
  };

  if (currentStep === "review") {
    return (
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Observation Definition Import — CSV Review</CardTitle>
            <CardDescription>
              Review and validate observation definitions before importing.
            </CardDescription>
            <div className="mt-4">
              <Progress value={100} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-4">
              <Badge variant="outline">Total: {summary.total}</Badge>
              <Badge variant="primary">Valid: {summary.valid}</Badge>
              <Badge variant="secondary">Invalid: {summary.invalid}</Badge>
            </div>

            <ObservationDefinitionReviewTable processedRows={processedRows} />

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button onClick={runImport} disabled={validRows.length === 0}>
                Import {validRows.length} Valid Row
                {validRows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "importing") {
    const processed = results?.processed ?? 0;
    const progress = totalToImport
      ? Math.round((processed / totalToImport) * 100)
      : 0;

    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Importing Observation Definitions</CardTitle>
            <CardDescription>
              Please keep this window open while we import your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Badge variant="outline">Processed: {processed}</Badge>
              <Badge variant="primary">Created: {results?.created ?? 0}</Badge>
              <Badge variant="secondary">Failed: {results?.failed ?? 0}</Badge>
              <Badge variant="outline">Skipped: {results?.skipped ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // done
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Observation Definition Import Results</CardTitle>
          <CardDescription>
            Import completed. Review the summary and any failed rows below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Badge variant="primary">Created: {results?.created ?? 0}</Badge>
            <Badge variant="secondary">Failed: {results?.failed ?? 0}</Badge>
            <Badge variant="outline">Skipped: {results?.skipped ?? 0}</Badge>
          </div>

          {results?.failures.length ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Row</th>
                      <th className="px-4 py-2 text-left">Title</th>
                      <th className="px-4 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.failures.map((failure) => (
                      <tr
                        key={`${failure.rowIndex}-${failure.title}`}
                        className="border-t border-gray-100"
                      >
                        <td className="px-4 py-2 text-gray-500">
                          {failure.rowIndex}
                        </td>
                        <td className="px-4 py-2">{failure.title ?? "-"}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {failure.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No failed rows 🎉</p>
          )}

          <div className="flex justify-end mt-6">
            <Button variant="outline" onClick={onBack}>
              Import Another File
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
