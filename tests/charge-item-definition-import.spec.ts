import { test, expect, Page } from "@playwright/test";
import { goToImport } from "./helpers/navigation";
import { createTempCsv, uploadCsvFile, cleanupTempFile } from "./helpers/csv";
import {
  downloadSampleCsv,
  expectReviewTable,
  clickImportButton,
  expectImportSuccess,
  expectValidationError,
  expectUploadError,
} from "./helpers/import-flow";

test.use({ storageState: "tests/.auth/user.json" });

async function enterCategory(page: Page) {
  await page
    .getByRole("textbox", { name: "e.g. Consultation Charges" })
    .fill(`Test Category ${Date.now()}`);
  await page.getByRole("button", { name: "Continue to Upload" }).click();
}

test.describe("Charge Item Definition Import", () => {
  test.beforeEach(async ({ page }) => {
    await goToImport(page, "charge-item-definition");
  });

  test("should show upload UI with sample download", async ({ page }) => {
    await expect(
      page.getByText("Import Charge Item Definitions"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /download sample/i }),
    ).toBeVisible();
  });

  test("should download sample CSV", async ({ page }) => {
    const download = await downloadSampleCsv(page);
    expect(download.suggestedFilename()).toContain("charge");
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test("should upload valid CSV and import", async ({ page }) => {
    await enterCategory(page);
    const suffix = Date.now();
    const csvPath = createTempCsv(
      [
        "title",
        "slug_value",
        "description",
        "purpose",
        "price",
        "status",
        "derived_from_uri",
        "version",
        "can_edit_charge_item",
      ],
      [
        [
          `Consultation Fee ${suffix}`,
          `consultation-fee-${suffix}`,
          "Doctor consultation",
          "Consultation",
          "250",
          "",
          "",
          "",
          "",
        ],
        [
          `Bed Charges ${suffix}`,
          `bed-charges-${suffix}`,
          "Per day bed charge",
          "Bed usage",
          "1500",
          "draft",
          "",
          "1",
          "false",
        ],
      ],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { validCount: 2, totalCount: 2 });
      await clickImportButton(page);
      await expectImportSuccess(page);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should detect duplicate slugs", async ({ page }) => {
    const csvPath = createTempCsv(
      ["title", "slug_value", "price"],
      [
        ["Item A", "same-slug", "100"],
        ["Item B", "same-slug", "200"], // duplicate
      ],
    );

    try {
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 2 });
      await expectValidationError(page, /duplicate slug/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for invalid slug format", async ({ page }) => {
    const csvPath = createTempCsv(
      ["title", "slug_value", "price"],
      [["Test Item", "Invalid Slug!", "100"]], // uppercase + special char
    );

    try {
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /slug must contain only/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing price", async ({ page }) => {
    const csvPath = createTempCsv(
      ["title", "slug_value", "price"],
      [["Test Item", "test-item", ""]], // missing price
    );

    try {
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /price is required/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing title", async ({ page }) => {
    const csvPath = createTempCsv(
      ["title", "slug_value", "price"],
      [["", "test-slug", "100"]],
    );

    try {
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /title is required/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing required headers", async ({ page }) => {
    const csvPath = createTempCsv(
      ["title"], // missing slug_value and price
      [["Some Item"]],
    );

    try {
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectUploadError(page, /missing required headers/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should update existing items on re-import", async ({ page }) => {
    const suffix = Date.now();
    // Create CSV with a fixed slug for re-import testing
    const csvPath = createTempCsv(
      ["title", "slug_value", "price"],
      [
        [
          `Re-import Test Item ${suffix}`,
          `re-import-test-${suffix}`,
          "100",
        ],
      ],
    );

    try {
      // First import
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
      await clickImportButton(page);
      await expectImportSuccess(page);

      // Go back to import page for second import
      await goToImport(page, "charge-item-definition");

      // Second import (update) with same slug
      await enterCategory(page);
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
      await clickImportButton(page);
      await expectImportSuccess(page);
    } finally {
      cleanupTempFile(csvPath);
    }
  });
});
