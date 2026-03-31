import { apis } from "@/apis";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  GENDERS,
  Gender,
  ImportResults,
  NORMALIZED_HEADER_MAP,
  ProcessedUserRow,
  REQUIRED_HEADERS,
  RawUserRow,
} from "@/types/usersImport";
import { parseCsvText } from "@/utils/csv";
import { AlertCircle, Upload } from "lucide-react";
import { useMemo, useState } from "react";

export default function UsersImportPage() {
  const [currentStep, setCurrentStep] = useState<
    "upload" | "review" | "importing" | "done"
  >("upload");
  const [uploadError, setUploadError] = useState<string>("");
  const [processedRows, setProcessedRows] = useState<ProcessedUserRow[]>([]);
  const [results, setResults] = useState<ImportResults | null>(null);

  const summary = useMemo(() => {
    const valid = processedRows.filter((row) => row.errors.length === 0).length;
    const invalid = processedRows.length - valid;
    return { total: processedRows.length, valid, invalid };
  }, [processedRows]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setUploadError("Please upload a valid CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const { headers, rows } = parseCsvText(csvText);

        if (headers.length === 0) {
          setUploadError("CSV is empty or missing headers");
          return;
        }

        const headerMap = buildHeaderMap(headers);
        const missingHeaders = REQUIRED_HEADERS.filter(
          (header) => headerMap[header] === undefined,
        );

        if (missingHeaders.length > 0) {
          setUploadError(
            `Missing required headers: ${missingHeaders.join(", ")}`,
          );
          return;
        }

        const processed = rows.map((row, index) =>
          processRow(row, index + 2, headerMap),
        );

        setUploadError("");
        setProcessedRows(processed);
        setCurrentStep("review");
      } catch (error) {
        setUploadError("Error processing CSV file");
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    const rowsToImport = processedRows.filter((row) => row.errors.length === 0);

    if (rowsToImport.length === 0) {
      setResults({
        processed: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        failures: [],
      });
      setCurrentStep("done");
      return;
    }

    setCurrentStep("importing");
    setResults({
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    });

    for (const row of rowsToImport) {
      const normalized = row.normalized;
      if (!normalized) continue;

      try {
        const existingUser = await fetchUser(normalized.username);
        if (existingUser) {
          setResults((prev) =>
            prev
              ? {
                  ...prev,
                  processed: prev.processed + 1,
                  skipped: prev.skipped + 1,
                }
              : prev,
          );
          continue;
        }

        await createUser(normalized);

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
                  {
                    rowIndex: row.rowIndex,
                    username: normalized.username,
                    reason,
                  },
                ],
              }
            : prev,
        );
      }
    }

    setCurrentStep("done");
  };

  const downloadSample = () => {
    const sampleCSV = `userType,prefix,firstName,lastName,email,phoneNumber,gender,geoOrganization,username,password
staff,Mr.,John,Doe,john.doe@example.com,9876543210,male,,john_doe,P@ssw0rd
nurse,Ms.,Jane,Smith,jane.smith@example.com,9876501234,female,,jane_smith,P@ssw0rd`;
    const blob = new Blob([sampleCSV], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_users_import.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadFailures = () => {
    if (!results || results.failures.length === 0) return;
    const failureCsv = [
      "rowIndex,username,reason",
      ...results.failures.map((failure) =>
        [failure.rowIndex, failure.username ?? "", failure.reason]
          .map((value) => `"${String(value).replace(/"/g, '"')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([failureCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_import_failures.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (currentStep === "upload") {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Users from CSV
            </CardTitle>
            <CardDescription>
              Upload a CSV file to create new users. Existing users will be
              skipped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="users-csv-upload"
              />
              <label htmlFor="users-csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <Upload className="h-12 w-12 text-gray-400" />
                  <div>
                    <p className="text-lg font-medium">
                      Click to upload CSV file
                    </p>
                    <p className="text-sm text-gray-500">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Expected columns: userType, prefix, firstName, lastName,
                    email, phoneNumber, gender, username, password
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    User types can be doctor, staff, nurse, volunteer,
                    administrator.
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadSample}>
                    Download Sample CSV
                  </Button>
                </div>
              </label>
            </div>

            {uploadError && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Valid User Types:</h4>
              <div className="flex flex-wrap gap-2">
                {["doctor", "staff", "nurse", "volunteer", "administrator"].map(
                  (type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "review") {
    return (
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Users Import Wizard</CardTitle>
            <CardDescription>
              Review and validate users before importing
            </CardDescription>
            <div className="mt-4">
              <Progress value={100} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            <div>
              <h3 className="text-lg font-semibold mb-4">Review All Users</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Row</th>
                        <th className="px-4 py-2 text-left">Username</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">User Type</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedRows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className="border-t border-gray-100"
                        >
                          <td className="px-4 py-2 text-gray-500">
                            {row.rowIndex}
                          </td>
                          <td className="px-4 py-2">
                            {row.normalized?.username || "—"}
                          </td>
                          <td className="px-4 py-2">
                            {row.normalized
                              ? `${row.normalized.firstName} ${row.normalized.lastName}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2">
                            {row.normalized?.userType ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {row.errors.length === 0 ? (
                              <span className="text-green-600">Valid</span>
                            ) : (
                              <span className="text-red-600">
                                {row.errors.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                className="mt-4"
                onClick={runImport}
                disabled={summary.valid === 0}
              >
                Start Import
              </Button>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep("upload")}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "importing") {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Importing Users</CardTitle>
            <CardDescription>
              {results?.processed ?? 0}/{summary.valid} processed
            </CardDescription>
            <div className="mt-4">
              <Progress
                value={
                  summary.valid
                    ? ((results?.processed ?? 0) / summary.valid) * 100
                    : 0
                }
                className="h-2"
              />
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Users Import Complete</CardTitle>
          <CardDescription>
            Created: {results?.created ?? 0} · Skipped: {results?.skipped ?? 0}{" "}
            · Failed: {results?.failed ?? 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results && results.failures.length > 0 && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {results.failures.slice(0, 5).map((failure) => (
                  <div key={`${failure.rowIndex}-${failure.username}`}>
                    Row {failure.rowIndex}: {failure.reason}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {results && results.failures.length > 0 && (
              <Button variant="outline" onClick={downloadFailures}>
                Download Failure Report
              </Button>
            )}
            <Button variant="outline" onClick={() => setCurrentStep("upload")}>
              Import Another File
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHeaderMap(headers: string[]) {
  const headerMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const mapped = NORMALIZED_HEADER_MAP[normalized];
    if (mapped) {
      headerMap[mapped] = index;
    }
  });
  return headerMap;
}

function processRow(
  row: string[],
  rowIndex: number,
  headerMap: Record<string, number>,
): ProcessedUserRow {
  const raw = Object.entries(headerMap).reduce((acc, [header, index]) => {
    acc[header] = row[index] ?? "";
    return acc;
  }, {} as RawUserRow);

  const errors: string[] = [];

  REQUIRED_HEADERS.forEach((header) => {
    if (!raw[header]?.trim()) {
      errors.push(`Missing ${header}`);
    }
  });

  const gender = raw.gender?.trim().toLowerCase() as Gender;
  if (gender && !GENDERS.includes(gender)) {
    errors.push(`Invalid gender: ${raw.gender}`);
  }

  const userType = raw.userType?.trim().toLowerCase();
  const username = raw.username
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");

  if (!username) {
    errors.push("Invalid username");
  }

  return {
    rowIndex,
    raw,
    errors,
    normalized:
      errors.length > 0
        ? null
        : {
            userType: userType ?? "",
            prefix: raw.prefix?.trim() ?? "",
            firstName: raw.firstName?.trim() ?? "",
            lastName: raw.lastName?.trim() ?? "",
            email: raw.email?.trim() ?? "",
            phoneNumber: raw.phoneNumber?.trim() ?? "",
            gender: gender,
            geoOrganization: raw.geoOrganization?.trim() || undefined,
            username: username ?? "",
            password: raw.password?.trim() ?? "",
          },
  };
}

async function fetchUser(username: string) {
  try {
    return await apis.user.get(username);
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 404) {
        return null;
      }
    }
    throw error;
  }
}

async function createUser(user: NonNullable<ProcessedUserRow["normalized"]>) {
  const phoneNumber = user.phoneNumber.startsWith("+")
    ? user.phoneNumber
    : `+91${user.phoneNumber}`;

  return await apis.user.create({
    user_type: user.userType,
    username: user.username,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    gender: user.gender,
    password: user.password,
    phone_number: phoneNumber,
    geo_organization: user.geoOrganization,
    role_orgs: [],
  });
}
