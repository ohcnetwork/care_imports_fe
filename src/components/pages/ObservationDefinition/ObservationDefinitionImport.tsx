import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { disableOverride } from "@/config";
import { useMasterDataAvailability } from "@/hooks/useMasterDataAvailability";
import {
  generateSampleComponentsCsv,
  generateSampleDefinitionsCsv,
} from "@/utils/observationDefinitionConstants";
import { AlertCircle, Database, Upload } from "lucide-react";
import { useState } from "react";

import MasterDataFileSelector from "@/components/shared/MasterDataFileSelector";
import ObservationDefinitionCsvImport from "./ObservationDefinitionCsvImport";
import ObservationDefinitionMasterImport from "./ObservationDefinitionMasterImport";

interface ObservationDefinitionImportProps {
  facilityId?: string;
}

type ActiveView =
  | { kind: "upload" }
  | { kind: "csv"; defsCsvText: string; compCsvText: string }
  | { kind: "master-select" }
  | { kind: "master"; defsCsvText: string; compCsvText: string };

export default function ObservationDefinitionImport({
  facilityId,
}: ObservationDefinitionImportProps) {
  const [activeView, setActiveView] = useState<ActiveView>({ kind: "upload" });
  const [uploadError, setUploadError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  const { availability, files } = useMasterDataAvailability();
  const repoFileAvailable = availability["observation-definition"];
  const disableManualUpload = disableOverride && repoFileAvailable;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disableManualUpload) {
      setUploadError(
        "Manual uploads are disabled because observation definition data is bundled with this build.",
      );
      setUploadedFileName("");
      return;
    }
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const csvFiles = Array.from(fileList).filter(
      (f) => f.type === "text/csv" || f.name.endsWith(".csv"),
    );

    if (csvFiles.length === 0) {
      setUploadError("Please upload valid CSV files");
      setUploadedFileName("");
      return;
    }

    if (csvFiles.length !== 2) {
      setUploadError(
        "Please select exactly 2 CSV files: one for observation definitions and one for components.",
      );
      setUploadedFileName("");
      return;
    }

    const readPromises = csvFiles.map(
      (file) =>
        new Promise<{ name: string; text: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({ name: file.name, text: e.target?.result as string });
          };
          reader.onerror = () =>
            reject(new Error(`Error reading ${file.name}`));
          reader.readAsText(file);
        }),
    );

    Promise.all(readPromises)
      .then((results) => {
        // Auto-detect which CSV is which by checking for "observation_slug" header
        let defsCsvText: string | null = null;
        let compCsvText: string | null = null;
        const names: string[] = [];

        for (const { name, text } of results) {
          const firstLine = text.split(/\r?\n/)[0] ?? "";
          const headers = firstLine.toLowerCase().replace(/[^a-z0-9_,]/g, "");
          if (headers.includes("observation_slug")) {
            compCsvText = text;
          } else {
            defsCsvText = text;
          }
          names.push(name);
        }

        if (!defsCsvText) {
          setUploadError(
            'Could not identify the definitions CSV. Make sure one file does NOT have an "observation_slug" header.',
          );
          setUploadedFileName("");
          return;
        }

        if (!compCsvText) {
          setUploadError(
            'Could not identify the components CSV. Make sure one file has an "observation_slug" header.',
          );
          setUploadedFileName("");
          return;
        }

        setUploadError("");
        setUploadedFileName(names.join(", "));
        setActiveView({ kind: "csv", defsCsvText, compCsvText });
      })
      .catch(() => {
        setUploadError("Error reading CSV files");
      });
  };

  const handleBundledImport = () => {
    setActiveView({ kind: "master-select" });
  };

  const downloadSampleCsvs = () => {
    const defsCsv = generateSampleDefinitionsCsv();
    const defsBlob = new Blob([defsCsv], { type: "text/csv" });
    const defsUrl = window.URL.createObjectURL(defsBlob);
    const defsLink = document.createElement("a");
    defsLink.href = defsUrl;
    defsLink.download = "sample_observation_definitions.csv";
    defsLink.click();
    window.URL.revokeObjectURL(defsUrl);

    const compCsv = generateSampleComponentsCsv();
    const compBlob = new Blob([compCsv], { type: "text/csv" });
    const compUrl = window.URL.createObjectURL(compBlob);
    const compLink = document.createElement("a");
    compLink.href = compUrl;
    compLink.download = "sample_observation_components.csv";
    compLink.click();
    window.URL.revokeObjectURL(compUrl);
  };

  const handleBack = () => {
    setActiveView({ kind: "upload" });
    setUploadedFileName("");
  };

  if (activeView.kind === "csv") {
    return (
      <ObservationDefinitionCsvImport
        facilityId={facilityId}
        defsCsvText={activeView.defsCsvText}
        compCsvText={activeView.compCsvText}
        onBack={handleBack}
      />
    );
  }

  if (activeView.kind === "master-select") {
    return (
      <MasterDataFileSelector
        title="Observation Definitions"
        files={files["observation-definition"]}
        selectCount={2}
        onFilesSelected={(selectedFiles) => {
          let defsCsvText: string | null = null;
          let compCsvText: string | null = null;

          for (const { csvText } of selectedFiles) {
            const firstLine = csvText.split(/\r?\n/)[0] ?? "";
            const headers = firstLine.toLowerCase().replace(/[^a-z0-9_,]/g, "");
            if (headers.includes("observation_slug")) {
              compCsvText = csvText;
            } else {
              defsCsvText = csvText;
            }
          }

          if (!defsCsvText || !compCsvText) {
            // Shouldn't happen with properly formatted master data,
            // but fall back gracefully: treat both as definitions
            defsCsvText = defsCsvText ?? selectedFiles[0]?.csvText ?? "";
            compCsvText = compCsvText ?? selectedFiles[1]?.csvText ?? "";
          }

          setActiveView({ kind: "master", defsCsvText, compCsvText });
        }}
        onBack={handleBack}
      />
    );
  }

  if (activeView.kind === "master") {
    return (
      <ObservationDefinitionMasterImport
        facilityId={facilityId}
        defsCsvText={activeView.defsCsvText}
        compCsvText={activeView.compCsvText}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2 items-start">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Observation Definitions from CSV
          </CardTitle>
          <CardDescription>
            Upload CSV files to create observation definitions and validate them
            before import. Select both files at once from the file picker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="observation-definition-csv-upload"
              disabled={disableManualUpload}
            />
            <label
              htmlFor="observation-definition-csv-upload"
              className={
                disableManualUpload
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }
            >
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium">
                    Click to upload CSV files
                  </p>
                  <p className="text-sm text-gray-500">
                    Select both definitions &amp; components CSVs at once
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  Definitions CSV (required) + Components CSV (optional)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadSampleCsvs();
                    }}
                  >
                    Download Sample CSVs
                  </Button>
                </div>
              </div>
            </label>
          </div>

          {uploadedFileName && (
            <p className="mt-3 text-sm text-gray-600">
              Selected file: {uploadedFileName}
            </p>
          )}

          {disableManualUpload && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Manual uploads are disabled because this build includes an
                observation definition dataset in the repository.
              </AlertDescription>
            </Alert>
          )}

          {uploadError && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Import Observation Definitions from dataset</CardTitle>
          <CardDescription>
            Import data for Observation Definitions from available master
            dataset.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-1">
          <div className="rounded-lg border border-gray-200 px-6 py-8 text-center text-s">
            <div className="flex flex-col items-center gap-4">
              <Database className="h-12 w-12 text-gray-400" />
              <div className="space-y-3">
                {repoFileAvailable ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-lg font-medium text-gray-600">
                      Click to Upload from master dataset
                    </p>
                    <p className="text-xs text-gray-400">
                      A bundled dataset is available in this build. You can
                      import it directly without uploading a CSV file.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBundledImport}
                      disabled={!repoFileAvailable}
                    >
                      Import Master Data
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    No bundled dataset was detected for this build. You can
                    upload a CSV file to import observation definitions
                    manually.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
