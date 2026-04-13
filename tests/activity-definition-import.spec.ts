import { test, expect } from "@playwright/test";
import { goToImport } from "./helpers/navigation";
import { createTempCsv, uploadCsvFile, cleanupTempFile } from "./helpers/csv";
import {
  downloadSampleCsv,
  expectReviewTable,
  expectValidationError,
  expectUploadError,
  clickImportButton,
  expectImportSuccess,
} from "./helpers/import-flow";

const AD_REQUIRED_HEADERS = [
  "title",
  "description",
  "usage",
  "classification",
  "category_name",
  "code_system",
  "code_value",
  "code_display",
];

const AD_OPTIONAL_HEADERS = [
  "slug_value",
  "status",
  "kind",
  "body_site_system",
  "body_site_code",
  "body_site_display",
  "diagnostic_report_system",
  "diagnostic_report_code",
  "diagnostic_report_display",
  "derived_from_uri",
  "specimen_slugs",
  "observation_slugs",
  "charge_item_slugs",
  "charge_item_price",
  "location_names",
  "healthcare_service_name",
];

const ALL_HEADERS = [...AD_REQUIRED_HEADERS, ...AD_OPTIONAL_HEADERS];

test.use({ storageState: "tests/.auth/user.json" });

function makeValidAdRow(suffix: string | number): string[] {
  return [
    `Test Activity ${suffix}`, // title
    "Test activity definition", // description
    "Order test for evaluation", // usage
    "laboratory", // classification
    "TestCategory", // category_name
    "http://snomed.info/sct", // code_system
    "26604007", // code_value
    "Complete blood count", // code_display
    ...new Array(AD_OPTIONAL_HEADERS.length).fill(""),
  ];
}

test.describe("Activity Definition Import", () => {
  test.beforeEach(async ({ page }) => {
    await goToImport(page, "activity-definition");
  });

  test("should show upload UI with CSV and master data options", async ({
    page,
  }) => {
    await expect(
      page.getByText(/import activity definitions from csv/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /download sample/i }),
    ).toBeVisible();
  });

  test("should download sample CSV", async ({ page }) => {
    const download = await downloadSampleCsv(page);
    expect(download.suggestedFilename()).toMatch(/activity/i);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test("should show master data section", async ({ page }) => {
    await expect(
      page.getByText(/import master data/i).or(page.getByText(/bundled data/i)),
    ).toBeVisible();
  });

  test("should show error for missing required headers", async ({ page }) => {
    const csvPath = createTempCsv(
      ["title", "description"], // missing most required headers
      [["Test", "A description"]],
    );

    try {
      await uploadCsvFile(page, csvPath);
      await expectUploadError(page, /missing required headers/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing title", async ({ page }) => {
    const csvPath = createTempCsv(ALL_HEADERS, [
      [
        "", // empty title
        "A description",
        "Some usage",
        "laboratory",
        "TestCategory",
        "http://snomed.info/sct",
        "26604007",
        "Complete blood count",
        ...new Array(AD_OPTIONAL_HEADERS.length).fill(""),
      ],
    ]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /title is required/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing description", async ({ page }) => {
    const csvPath = createTempCsv(ALL_HEADERS, [
      [
        "Test Activity",
        "", // empty description
        "Some usage",
        "laboratory",
        "TestCategory",
        "http://snomed.info/sct",
        "26604007",
        "Complete blood count",
        ...new Array(AD_OPTIONAL_HEADERS.length).fill(""),
      ],
    ]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /description is required/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing code fields", async ({ page }) => {
    const csvPath = createTempCsv(ALL_HEADERS, [
      [
        "Test Activity",
        "A description",
        "Some usage",
        "laboratory",
        "TestCategory",
        "", // empty code_system
        "", // empty code_value
        "", // empty code_display
        ...new Array(AD_OPTIONAL_HEADERS.length).fill(""),
      ],
    ]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /code value is required/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for missing category_name", async ({ page }) => {
    const csvPath = createTempCsv(ALL_HEADERS, [
      [
        "Test Activity",
        "A description",
        "Some usage",
        "laboratory",
        "", // empty category_name
        "http://snomed.info/sct",
        "26604007",
        "Complete blood count",
        ...new Array(AD_OPTIONAL_HEADERS.length).fill(""),
      ],
    ]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /category name is required/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error for invalid slug format", async ({ page }) => {
    const row = makeValidAdRow("slug-test");
    // Set slug_value (first optional header) to invalid value
    row[AD_REQUIRED_HEADERS.length] = "INVALID SLUG WITH SPACES";

    const csvPath = createTempCsv(ALL_HEADERS, [row]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1 });
      await expectValidationError(page, /slug must contain only/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should upload valid CSV and reach review step", async ({ page }) => {
    const suffix = Date.now();
    const csvPath = createTempCsv(ALL_HEADERS, [makeValidAdRow(suffix)]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should complete full import flow", async ({ page }) => {
    const suffix = Date.now();
    const csvPath = createTempCsv(ALL_HEADERS, [makeValidAdRow(suffix)]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { validCount: 1, totalCount: 1 });
      await clickImportButton(page);
      await expectImportSuccess(page);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error in review for non-existing specimen dependency", async ({
    page,
  }) => {
    const suffix = Date.now();
    const row = makeValidAdRow(suffix);
    const specimenIndex =
      AD_REQUIRED_HEADERS.length +
      AD_OPTIONAL_HEADERS.indexOf("specimen_slugs");
    row[specimenIndex] = "nonexistent-specimen-slug";

    const csvPath = createTempCsv(ALL_HEADERS, [row]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1, totalCount: 1 });
      await expectValidationError(page, /specimen definition not found/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error in review for non-existing observation dependency", async ({
    page,
  }) => {
    const suffix = Date.now();
    const row = makeValidAdRow(suffix);
    const observationIndex =
      AD_REQUIRED_HEADERS.length +
      AD_OPTIONAL_HEADERS.indexOf("observation_slugs");
    row[observationIndex] = "nonexistent-observation-slug";

    const csvPath = createTempCsv(ALL_HEADERS, [row]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1, totalCount: 1 });
      await expectValidationError(page, /observation definition not found/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error in review for non-existing charge item dependency", async ({
    page,
  }) => {
    const suffix = Date.now();
    const row = makeValidAdRow(suffix);
    const chargeItemIndex =
      AD_REQUIRED_HEADERS.length +
      AD_OPTIONAL_HEADERS.indexOf("charge_item_slugs");
    row[chargeItemIndex] = "nonexistent-charge-item-slug";

    const csvPath = createTempCsv(ALL_HEADERS, [row]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1, totalCount: 1 });
      await expectValidationError(page, /charge item definition not found/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error in review for non-existing location dependency", async ({
    page,
  }) => {
    const suffix = Date.now();
    const row = makeValidAdRow(suffix);
    const locationIndex =
      AD_REQUIRED_HEADERS.length +
      AD_OPTIONAL_HEADERS.indexOf("location_names");
    row[locationIndex] = "Nonexistent Location XYZ";

    const csvPath = createTempCsv(ALL_HEADERS, [row]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1, totalCount: 1 });
      await expectValidationError(page, /location not found/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });

  test("should show error in review for non-existing healthcare service dependency", async ({
    page,
  }) => {
    const suffix = Date.now();
    const row = makeValidAdRow(suffix);
    const hsIndex =
      AD_REQUIRED_HEADERS.length +
      AD_OPTIONAL_HEADERS.indexOf("healthcare_service_name");
    row[hsIndex] = "Nonexistent Healthcare Service";

    const csvPath = createTempCsv(ALL_HEADERS, [row]);

    try {
      await uploadCsvFile(page, csvPath);
      await expectReviewTable(page, { invalidCount: 1, totalCount: 1 });
      await expectValidationError(page, /healthcare service not found/i);
    } finally {
      cleanupTempFile(csvPath);
    }
  });
});
