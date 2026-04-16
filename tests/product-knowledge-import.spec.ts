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

test.describe("Product Knowledge Import", () => {
  test.beforeEach(async ({ page }) => {
    await goToImport(page, "product-knowledge");
  });

  // ─── Upload Screen ───────────────────────────────────────────────

  test("should show upload UI with CSV and master data options", async ({
    page,
  }) => {
    await expect(
      page.getByText(/import product knowledges from csv/i),
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
    expect(download.suggestedFilename()).toContain("product knowledge");
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  // ─── CSV Path ────────────────────────────────────────────────────

  test("should upload valid CSV and import", async ({ page }) => {
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
    const csvPath = createTempCsv(
      ["resourceCategory", "slug", "name", "productType", "baseUnitDisplay"],
      [
        ["Medication", "same-slug", "PK One", "medication", "tablets"],
        ["Medication", "same-slug", "PK Two", "medication", "tablets"],
      ],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 2 });
      await expectValidationError(page, /duplicate slug/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for invalid product type", async ({ page }) => {
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
    const available = await isMasterDataAvailable(page);
    if (available) {
      await openMasterDataSelector(page);
      await expect(page.getByText(/select a master data file/i)).toBeVisible();
      await clickMasterDataBack(page);
      await expect(
        page.getByText(/import product knowledge from csv/i),
      ).toBeVisible();
    }
  });

  test("should import from master data file", async ({ page }) => {
    const available = await isMasterDataAvailable(page);
    if (available) {
      await openMasterDataSelector(page);
      await selectFirstMasterFile(page);

      // Should transition to ImportFlow with pre-parsed rows
      await expect(page.getByText(/^Review /)).toBeVisible({ timeout: 15_000 });
    }
  });
});
