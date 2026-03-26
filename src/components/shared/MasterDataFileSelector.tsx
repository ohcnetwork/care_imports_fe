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

interface MasterDataFileSelectorBaseProps {
  /** Human-readable label, e.g. "Product Knowledge" */
  title: string;
  /** List of available CSV files for this dataset */
  files: MasterDataFile[];
  /** Go back to the upload screen */
  onBack: () => void;
}

interface SingleSelectProps extends MasterDataFileSelectorBaseProps {
  /** How many files the user must select. Defaults to 1 (single-click). */
  selectCount?: 1;
  /** Called when the user picks a file and its CSV text has been fetched */
  onFileSelected: (csvText: string, fileName: string) => void;
  onFilesSelected?: never;
}

interface MultiSelectProps extends MasterDataFileSelectorBaseProps {
  /** Set to 2 to require the user to pick exactly 2 files */
  selectCount: 2;
  /** Called with all fetched CSV texts when the user confirms selection */
  onFilesSelected: (
    files: { csvText: string; fileName: string }[],
  ) => void;
  onFileSelected?: never;
}

type MasterDataFileSelectorProps = SingleSelectProps | MultiSelectProps;

export default function MasterDataFileSelector(
  props: MasterDataFileSelectorProps,
) {
  const { title, files, onBack } = props;
  const selectCount = props.selectCount ?? 1;

  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // ── Single-select: click to pick ──
  const handleSingleSelect = async (file: MasterDataFile) => {
    if (selectCount !== 1 || !("onFileSelected" in props) || !props.onFileSelected) return;
    setError("");
    setLoadingFile(file.name);

    try {
      const response = await fetch(file.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file.name}`);
      }
      const csvText = await response.text();
      props.onFileSelected(csvText, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading file");
    } finally {
      setLoadingFile(null);
    }
  };

  // ── Multi-select: toggle checkbox ──
  const toggleSelection = (fileName: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        if (next.size >= selectCount) {
          // Already at max — remove oldest and add new
          const first = next.values().next().value;
          if (first !== undefined) next.delete(first);
        }
        next.add(fileName);
      }
      return next;
    });
  };

  // ── Multi-select: confirm and fetch ──
  const handleMultiConfirm = async () => {
    if (selectCount === 1 || !("onFilesSelected" in props) || !props.onFilesSelected) return;
    setError("");
    setLoading(true);

    try {
      const selected = files.filter((f) => selectedNames.has(f.name));
      const results = await Promise.all(
        selected.map(async (file) => {
          const response = await fetch(file.url, { cache: "no-store" });
          if (!response.ok) throw new Error(`Failed to fetch ${file.name}`);
          const csvText = await response.text();
          return { csvText, fileName: file.name };
        }),
      );
      props.onFilesSelected(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading files");
    } finally {
      setLoading(false);
    }
  };

  /** Strip the .csv extension and replace underscores with spaces for display */
  const formatFileName = (name: string) =>
    name
      .replace(/\.csv$/i, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const isMulti = selectCount > 1;

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Select {isMulti ? `${selectCount} ` : "a "}Master Data File{isMulti ? "s" : ""} — {title}</CardTitle>
          <CardDescription>
            {isMulti
              ? `Select exactly ${selectCount} CSV files from the master data repository.`
              : "Choose which CSV file to import from the master data repository."}
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
                const isSelected = selectedNames.has(file.name);
                return (
                  <button
                    key={file.name}
                    onClick={() =>
                      isMulti
                        ? toggleSelection(file.name)
                        : handleSingleSelect(file)
                    }
                    disabled={loadingFile !== null || loading}
                    className={`flex items-center gap-4 rounded-lg border px-5 py-4 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {isMulti && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="h-4 w-4 shrink-0"
                      />
                    )}
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

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            {isMulti && (
              <Button
                onClick={handleMultiConfirm}
                disabled={
                  selectedNames.size !== selectCount || loading
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </>
                ) : (
                  `Continue with ${selectedNames.size} file${selectedNames.size !== 1 ? "s" : ""}`
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
