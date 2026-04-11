import { test, expect } from "@playwright/test";
import { goToImport } from "./helpers/navigation";
import { createTempCsv, cleanupTempFile } from "./helpers/csv";
import {
  expectReviewTable,
  clickImportButton,
  expectImportSuccess,
  expectValidationError,
} from "./helpers/import-flow";

test.use({ storageState: "tests/.auth/user.json" });

/** OD definitions CSV headers */
const DEF_HEADERS = [
  "title",
  "slug_value",
  "description",
  "category",
  "permitted_data_type",
  "code_system",
  "code_value",
  "code_display",
  "status",
];

/** OD components CSV headers */
const COMP_HEADERS = [
  "observation_slug",
  "code_system",
  "code_value",
  "code_display",
  "permitted_data_type",
  "unit_system",
  "unit_code",
  "unit_display",
];

/** Upload two CSV files (definitions + components) to the OD import page. */
async function uploadObsDefCsvs(
  page: import("@playwright/test").Page,
  defPath: string,
  compPath: string,
) {
  const fileInput = page.locator("#obs-def-csv-upload");
  await fileInput.setInputFiles([defPath, compPath]);
}

function makeValidDefRow(suffix: string | number): string[] {
  return [
    `Blood Pressure ${suffix}`,
    `bp-${suffix}`,
    "Blood pressure measurement",
    "vital_signs",
    "quantity",
    "http://loinc.org",
    "85354-9",
    "Blood pressure panel",
    "active",
  ];
}

function makeEmptyComponentsCsv(): string {
  return createTempCsv(COMP_HEADERS, [], "components.csv");
}

test.describe("Observation Definition Import", () => {
  test.beforeEach(async ({ page }) => {
    await goToImport(page, "observation-definition");
  });

  test("should show upload UI with CSV and master data options", async ({
    page,
  }) => {
    await expect(
      page.getByText(/import observation definitions from csv/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /download sample/i }),
    ).toBeVisible();
  });

  test("should download sample CSVs", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download sample/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/observation/i);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test("should require exactly 2 CSV files", async ({ page }) => {
    // Upload only 1 file — should show error
    const defPath = createTempCsv(
      DEF_HEADERS,
      [makeValidDefRow(Date.now())],
      "defs.csv",
    );

    try {
      const fileInput = page.locator("#obs-def-csv-upload");
      await fileInput.setInputFiles(defPath);
      await expect(page.getByText(/select exactly 2 csv files/i)).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      cleanupTempFile(defPath);
    }
  });

  test("should upload valid definitions + components and import", async ({
    page,
  }) => {
    const suffix = Date.now();
    const defPath = createTempCsv(
      DEF_HEADERS,
      [makeValidDefRow(suffix)],
      "definitions.csv",
    );
    const compPath = createTempCsv(
      COMP_HEADERS,
      [
        [
          `bp-${suffix}`,
          "http://loinc.org",
          "8480-6",
          "Systolic blood pressure",
          "Quantity",
          "http://unitsofmeasure.org",
          "mm[Hg]",
          "mmHg",
        ],
      ],
      "components.csv",
    );

    try {
      await uploadObsDefCsvs(page, defPath, compPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
      await clickImportButton(page);
      await expectImportSuccess(page);
    } finally {
      cleanupTempFile(defPath);
      cleanupTempFile(compPath);
    }
  });

  test("should upload definitions without components and import", async ({
    page,
  }) => {
    const suffix = Date.now();
    const defPath = createTempCsv(
      DEF_HEADERS,
      [makeValidDefRow(suffix)],
      "definitions.csv",
    );
    const compPath = makeEmptyComponentsCsv();

    try {
      await uploadObsDefCsvs(page, defPath, compPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
      await clickImportButton(page);
      await expectImportSuccess(page);
    } finally {
      cleanupTempFile(defPath);
      cleanupTempFile(compPath);
    }
  });

  test("should show error for partial code triplet (code without display)", async ({
    page,
  }) => {
    const defPath = createTempCsv(
      [
        "title",
        "slug_value",
        "description",
        "category",
        "permitted_data_type",
        "status",
        "code_system",
        "code_value",
        "code_display",
        "body_site_system",
        "body_site_code",
        "body_site_display",
      ],
      [
        [
          "Test OD",
          "test-od",
          "Test",
          "vital_signs",
          "quantity",
          "active",
          "http://loinc.org",
          "12345",
          "Test code",
          "http://snomed.info/sct",
          "some-code", // code provided
          "", // display missing → triggers triplet error
        ],
      ],
      "definitions.csv",
    );
    const compPath = makeEmptyComponentsCsv();

    try {
      await uploadObsDefCsvs(page, defPath, compPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(
        page,
        /display is required when code is set/i,
      );
    } finally {
      cleanupTempFile(defPath);
      cleanupTempFile(compPath);
    }
  });

  test("should show error for invalid qualified_ranges JSON", async ({
    page,
  }) => {
    const defPath = createTempCsv(
      [...DEF_HEADERS, "qualified_ranges"],
      [
        [
          "Test OD",
          "test-od-json",
          "Test",
          "vital_signs",
          "quantity",
          "http://loinc.org",
          "12345",
          "Test",
          "active",
          "not valid json",
        ],
      ],
      "definitions.csv",
    );
    const compPath = makeEmptyComponentsCsv();

    try {
      await uploadObsDefCsvs(page, defPath, compPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /qualified_ranges must be/i);
    } finally {
      cleanupTempFile(defPath);
      cleanupTempFile(compPath);
    }
  });

  test("should show error for non-array qualified_ranges", async ({ page }) => {
    const defPath = createTempCsv(
      [...DEF_HEADERS, "qualified_ranges"],
      [
        [
          "Test OD",
          "test-od-obj",
          "Test",
          "vital_signs",
          "quantity",
          "http://loinc.org",
          "12345",
          "Test",
          "active",
          '{"not": "array"}',
        ],
      ],
      "definitions.csv",
    );
    const compPath = makeEmptyComponentsCsv();

    try {
      await uploadObsDefCsvs(page, defPath, compPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(
        page,
        /qualified_ranges must be a json array/i,
      );
    } finally {
      cleanupTempFile(defPath);
      cleanupTempFile(compPath);
    }
  });

  test("should detect duplicate slugs", async ({ page }) => {
    const defPath = createTempCsv(
      DEF_HEADERS,
      [
        [
          "OD One",
          "same-slug",
          "Desc",
          "vital_signs",
          "quantity",
          "http://loinc.org",
          "1",
          "One",
          "active",
        ],
        [
          "OD Two",
          "same-slug",
          "Desc",
          "vital_signs",
          "quantity",
          "http://loinc.org",
          "2",
          "Two",
          "active",
        ],
      ],
      "definitions.csv",
    );
    const compPath = makeEmptyComponentsCsv();

    try {
      await uploadObsDefCsvs(page, defPath, compPath);
      await expectReviewTable(page, { invalidCount: 2 });
      await expectValidationError(page, /duplicate slug/i);
    } finally {
      cleanupTempFile(defPath);
      cleanupTempFile(compPath);
    }
  });

  test("should show error when files cannot be detected as defs vs components", async ({
    page,
  }) => {
    // Two files, neither has observation_slug header
    const file1 = createTempCsv(
      ["title", "slug_value"],
      [["A", "a"]],
      "file1.csv",
    );
    const file2 = createTempCsv(
      ["title", "slug_value"],
      [["B", "b"]],
      "file2.csv",
    );

    try {
      const fileInput = page.locator("#obs-def-csv-upload");
      await fileInput.setInputFiles([file1, file2]);
      await expect(page.getByText(/could not detect/i)).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      cleanupTempFile(file1);
      cleanupTempFile(file2);
    }
  });
});
