export const GENDERS = ["male", "female", "transgender", "non_binary"] as const;

export type Gender = (typeof GENDERS)[number];

export type RawUserRow = Record<string, string>;

export interface ProcessedUserRow {
  rowIndex: number;
  raw: RawUserRow;
  errors: string[];
  normalized: {
    userType: string;
    prefix: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    gender: Gender;
    geoOrganization?: string;
    username: string;
    password: string;
  } | null;
}

export interface ImportResults {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  failures: { rowIndex: number; username?: string; reason: string }[];
}
