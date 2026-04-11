import { test, expect } from "@playwright/test";
import { goToImport } from "./helpers/navigation";
import { createTempCsv, uploadCsvFile, cleanupTempFile } from "./helpers/csv";
import {
  downloadSampleCsv,
  expectReviewTable,
  clickImportButton,
  expectImportSuccess,
  expectValidationError,
  expectUploadError,
  clickBack,
} from "./helpers/import-flow";
import {
  isMasterDataAvailable,
  openMasterDataSelector,
  selectFirstMasterFile,
  clickMasterDataBack,
} from "./helpers/master-data";

test.use({ storageState: "tests/.auth/user.json" });

/** Click the dashed CSV upload area to enter CSV import mode. */
async function enterCsvMode(page: import("@playwright/test").Page) {
  await page.locator(".border-dashed", { hasText: /click to upload/i }).click();
  // Wait for ImportFlow's file input to appear
  await expect(page.locator('input[type="file"][accept=".csv"]')).toBeAttached({
    timeout: 5_000,
  });
}

test.describe("Product Knowledge Import", () => {
  test.beforeEach(async ({ page }) => {
    await goToImport(page, "product-knowledge");
  });

  // ─── Upload Screen ───────────────────────────────────────────────

  test("should show upload UI with CSV and master data options", async ({
    page,
  }) => {
    await expect(
      page.getByText(/import product knowledge from csv/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /download sample/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/import product knowledge from dataset/i),
    ).toBeVisible();
  });

  test("should download sample CSV from upload screen", async ({ page }) => {
    const download = await downloadSampleCsv(page);
    expect(download.suggestedFilename()).toContain("product_knowledge");
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  // ─── CSV Path ────────────────────────────────────────────────────

  test("should enter CSV mode and show Back button", async ({ page }) => {
    await enterCsvMode(page);
    await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
  });

  test("should return to upload screen via Back button in CSV mode", async ({
    page,
  }) => {
    await enterCsvMode(page);
    await page.getByRole("button", { name: /back/i }).click();
    await expect(
      page.getByText(/import product knowledge from csv/i),
    ).toBeVisible();
  });

  test("should upload valid CSV and import", async ({ page }) => {
    await enterCsvMode(page);
    const suffix = Date.now();
    const csvPath = createTempCsv(
      [
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
      ],
      [
        [
          "Medication",
          `test-pk-${suffix}`,
          `Test PK ${suffix}`,
          "medication",
          "",
          "",
          "tablets",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
      ],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
      await clickImportButton(page);
      await expectImportSuccess(page);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for invalid base unit", async ({ page }) => {
    await enterCsvMode(page);
    const csvPath = createTempCsv(
      ["resourceCategory", "slug", "name", "productType", "baseUnitDisplay"],
      [
        [
          "Medication",
          "test-pk-invalid",
          "Test PK",
          "medication",
          "invalid_unit",
        ],
      ],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /could not resolve base unit/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for duplicate slugs", async ({ page }) => {
    await enterCsvMode(page);
    const csvPath = createTempCsv(
      ["resourceCategory", "slug", "name", "productType", "baseUnitDisplay"],
      [
        ["Medication", "same-slug", "PK One", "medication", "tablets"],
        ["Medication", "same-slug", "PK Two", "medication", "tablets"],
      ],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /duplicate slug/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for invalid product type", async ({ page }) => {
    await enterCsvMode(page);
    const csvPath = createTempCsv(
      ["resourceCategory", "slug", "name", "productType", "baseUnitDisplay"],
      [["Medication", "test-pk", "Test", "invalid_type", "tablets"]],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /medication|consumable|nutritional/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for invalid slug format", async ({ page }) => {
    await enterCsvMode(page);
    const csvPath = createTempCsv(
      ["resourceCategory", "slug", "name", "productType", "baseUnitDisplay"],
      [["Medication", "Invalid Slug!", "Test", "medication", "tablets"]],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /slug must contain only/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing required headers", async ({ page }) => {
    await enterCsvMode(page);
    const csvPath = createTempCsv(["slug", "name"], [["test-slug", "Test"]]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectUploadError(page, /missing required headers/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  // ─── Master Data Path ───────────────────────────────────────────

  test("should show master data selector and navigate back", async ({
    page,
  }) => {
    test.skip(
      !(await isMasterDataAvailable(page)),
      "No master data available in this build",
    );

    await openMasterDataSelector(page);
    await expect(page.getByText(/product knowledge/i)).toBeVisible();
    await clickMasterDataBack(page);
    await expect(
      page.getByText(/import product knowledge from csv/i),
    ).toBeVisible();
  });

  test("should import from master data file", async ({ page }) => {
    test.skip(
      !(await isMasterDataAvailable(page)),
      "No master data available in this build",
    );

    await openMasterDataSelector(page);
    await selectFirstMasterFile(page);

    // Should transition to ImportFlow with pre-parsed rows
    await expect(page.getByText(/^Review /)).toBeVisible({ timeout: 15_000 });
  });
});
