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
