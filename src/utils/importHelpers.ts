import { APIError, request } from "@/apis";

/**
 * Shared types for import pages.
 */

export interface PaginatedResponse<T> {
  results: T[];
  count?: number;
}

export interface ImportResults {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  failures: {
    rowIndex: number;
    title?: string;
    name?: string;
    reason: string;
  }[];
}

/**
 * Shared utility functions for import pages.
 */

export const normalizeName = (value: string) => value.trim().toLowerCase();

export const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

/**
 * Try to GET an existing record by its slug and return its external_id.
 * Returns undefined if the record doesn't exist (404).
 */
export const fetchExistingId = async (
  detailPath: string,
): Promise<string | undefined> => {
  try {
    const existing = await request<{ id: string }>(detailPath, {
      method: "GET",
    });
    return existing.id;
  } catch (error) {
    if (error instanceof APIError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
};
