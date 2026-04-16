import { FullConfig } from "@playwright/test";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Token name constants
const ACCESS_TOKEN_KEY = "care_access_token";
const REFRESH_TOKEN_KEY = "care_refresh_token";

/**
 * Interface for localStorage items in Playwright storage state
 */
interface LocalStorageItem {
  name: string;
  value: string;
}

/**
 * Refresh authentication tokens using native fetch.
 */
async function refreshTokens() {
  const authFile = path.join(__dirname, ".auth/user.json");

  if (!fs.existsSync(authFile)) {
    console.log("⚠️ Auth file not found, skipping token refresh");
    return;
  }

  try {
    const storageState = JSON.parse(fs.readFileSync(authFile, "utf-8"));

    if (
      !Array.isArray(storageState.origins) ||
      storageState.origins.length === 0
    ) {
      console.log(
        "⚠️ No origins found in storage state, skipping token refresh",
      );
      return;
    }

    const firstOrigin = storageState.origins[0];
    const localStorage: LocalStorageItem[] = Array.isArray(
      firstOrigin.localStorage,
    )
      ? firstOrigin.localStorage
      : [];
    const accessTokenEntry = localStorage.find(
      (item: LocalStorageItem) => item.name === ACCESS_TOKEN_KEY,
    );
    const refreshTokenEntry = localStorage.find(
      (item: LocalStorageItem) => item.name === REFRESH_TOKEN_KEY,
    );

    if (!accessTokenEntry || !refreshTokenEntry) {
      console.log("⚠️ No tokens found in storage state");
      return;
    }

    const refreshToken = refreshTokenEntry.value;
    const apiUrl = process.env.REACT_CARE_API_URL || "http://localhost:9000";

    console.log("🔄 Refreshing authentication tokens...");

    const response = await fetch(`${apiUrl}/api/v1/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();

      const accessIndex = localStorage.findIndex(
        (item: LocalStorageItem) => item.name === ACCESS_TOKEN_KEY,
      );
      const refreshIndex = localStorage.findIndex(
        (item: LocalStorageItem) => item.name === REFRESH_TOKEN_KEY,
      );

      if (accessIndex !== -1) {
        localStorage[accessIndex].value = data.access;
      }
      if (refreshIndex !== -1 && data.refresh) {
        localStorage[refreshIndex].value = data.refresh;
      }

      fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));

      console.log("✅ Tokens refreshed successfully");
    } else {
      console.log(`⚠️ Token refresh failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Error refreshing tokens:", error);
  }
}

/**
 * Global setup that runs once before all tests.
 * 1. Restores database from snapshot (local only)
 * 2. Refreshes authentication tokens
 */
async function globalSetup(_config: FullConfig) {
  await refreshTokens();
}

export default globalSetup;
