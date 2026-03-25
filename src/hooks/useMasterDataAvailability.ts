import { useEffect, useState } from "react";

export interface MasterDataFile {
  /** Raw download URL for the CSV file */
  url: string;
  /** Filename (e.g. "product_knowledge.csv") */
  name: string;
}

const REPO = import.meta.env.REACT_MASTER_DATA_REPO as string | undefined;
const BRANCH = (import.meta.env.REACT_MASTER_DATA_BRANCH as string) || "main";

/** GitHub Contents API entry */
interface GitHubContentEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

/**
 * index.json in the master data repo.
 *
 * Maps dataset keys (used by import pages) to actual folder paths in the repo:
 * {
 *   "datasets": {
 *     "product-knowledge": "product_knowledge",
 *     "specimen-definition": "specimen_definition",
 *     ...
 *   }
 * }
 */
interface MasterDataIndex {
  datasets: Record<string, string>;
}

type Status = "idle" | "loading" | "ready" | "error";

/**
 * Fetches CSV file listings from a public GitHub repo.
 *
 * 1. Fetches index.json from the repo root to discover available datasets
 * 2. For each dataset, calls GitHub Contents API to list CSV files
 *
 * Env vars:
 *   REACT_MASTER_DATA_REPO   — "owner/repo" (e.g. "ohcnetwork/care-master-data")
 *   REACT_MASTER_DATA_BRANCH — branch name (defaults to "main")
 */
export const useMasterDataAvailability = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Record<string, MasterDataFile[]>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!REPO) {
        setStatus("error");
        setError(
          "REACT_MASTER_DATA_REPO is not configured. Set it to 'owner/repo' (e.g. ohcnetwork/care-master-data).",
        );
        return;
      }

      setStatus("loading");
      setError("");

      try {
        // 1. Fetch index.json from the repo
        const indexUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/index.json`;
        const indexResponse = await fetch(indexUrl, { cache: "no-store" });
        if (!indexResponse.ok) {
          throw new Error(
            "index.json not found in the master data repository.",
          );
        }
        const index = (await indexResponse.json()) as MasterDataIndex;

        if (!index.datasets || typeof index.datasets !== "object") {
          throw new Error("index.json is missing a valid 'datasets' field.");
        }

        const resolvedFiles: Record<string, MasterDataFile[]> = {};
        const resolvedAvailability: Record<string, boolean> = {};

        // Initialize all datasets from index
        for (const key of Object.keys(index.datasets)) {
          resolvedFiles[key] = [];
          resolvedAvailability[key] = false;
        }

        // 2. For each dataset, list CSV files via GitHub Contents API
        await Promise.all(
          Object.entries(index.datasets).map(
            async ([datasetKey, folderPath]) => {
              const apiUrl = `https://api.github.com/repos/${REPO}/contents/${folderPath}?ref=${BRANCH}`;

              try {
                const response = await fetch(apiUrl, {
                  headers: { Accept: "application/vnd.github.v3+json" },
                  cache: "no-store",
                });

                if (!response.ok) return;

                const entries = (await response.json()) as GitHubContentEntry[];

                const csvFiles: MasterDataFile[] = entries
                  .filter(
                    (entry) =>
                      entry.type === "file" && entry.name.endsWith(".csv"),
                  )
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((entry) => ({
                    name: entry.name,
                    url:
                      entry.download_url ??
                      `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${entry.path}`,
                  }));

                resolvedFiles[datasetKey] = csvFiles;
                resolvedAvailability[datasetKey] = csvFiles.length > 0;
              } catch {
                // Network error for this folder — skip
              }
            },
          ),
        );

        if (!active) return;

        setFiles(resolvedFiles);
        setAvailability(resolvedAvailability);
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setFiles({});
        setAvailability({});
        setError(
          err instanceof Error ? err.message : "Failed to load master data",
        );
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  return { status, error, files, availability };
};
