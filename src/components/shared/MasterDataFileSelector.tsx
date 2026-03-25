import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MasterDataFile } from "@/hooks/useMasterDataAvailability";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

interface MasterDataFileSelectorProps {
  /** Human-readable label, e.g. "Product Knowledge" */
  title: string;
  /** List of available CSV files for this dataset */
  files: MasterDataFile[];
  /** Called when the user picks a file and its CSV text has been fetched */
  onFileSelected: (csvText: string, fileName: string) => void;
  /** Go back to the upload screen */
  onBack: () => void;
}

export default function MasterDataFileSelector({
  title,
  files,
  onFileSelected,
  onBack,
}: MasterDataFileSelectorProps) {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSelect = async (file: MasterDataFile) => {
    setError("");
    setLoadingFile(file.name);

    try {
      const response = await fetch(file.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file.name}`);
      }
      const csvText = await response.text();
      onFileSelected(csvText, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading file");
    } finally {
      setLoadingFile(null);
    }
  };

  /** Strip the .csv extension and replace underscores with spaces for display */
  const formatFileName = (name: string) =>
    name
      .replace(/\.csv$/i, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Select a Master Data File — {title}</CardTitle>
          <CardDescription>
            Choose which CSV file to import from the master data repository.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-sm text-gray-500">
              No files found for this dataset.
            </p>
          ) : (
            <div className="grid gap-3">
              {files.map((file) => {
                const isLoading = loadingFile === file.name;
                return (
                  <button
                    key={file.name}
                    onClick={() => handleSelect(file)}
                    disabled={loadingFile !== null}
                    className="flex items-center gap-4 rounded-lg border border-gray-200 px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 text-gray-400 animate-spin shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {formatFileName(file.name)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {file.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-start mt-6">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
