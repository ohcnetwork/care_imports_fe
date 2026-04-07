import type { ApiRoute, QueryParams } from "./types";

const CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY = "care_access_token";

// ─── API Error ─────────────────────────────────────────────────────
export class APIError extends Error {
  status: number;
  cause?: unknown;

  constructor(message: string, status: number, cause?: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.cause = cause;
  }
}

// ─── URL Resolution ────────────────────────────────────────────────
function resolveApiUrl(path: string): string {
  const coreEnv = (window as Window & { __CORE_ENV__?: { apiUrl?: string } })
    .__CORE_ENV__;
  const envUrl =
    (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env
      ?.VITE_API_BASE_URL || "";
  const apiUrl = coreEnv?.apiUrl || envUrl;

  if (!apiUrl) {
    throw new Error(
      "API base URL is not configured. Set window.__CORE_ENV__.apiUrl or VITE_API_BASE_URL.",
    );
  }

  return `${apiUrl}${path}`;
}

// ─── Query String Builder ──────────────────────────────────────────
export function queryString(
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return "";

  const paramString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");

  return paramString ? `?${paramString}` : "";
}

// ─── Base Request Function ─────────────────────────────────────────
export async function request<TRes>(
  path: string,
  options?: RequestInit,
): Promise<TRes> {
  const url = path.startsWith("http") ? path : resolveApiUrl(path);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem(CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY)}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const contentType = response.headers.get("Content-Type") || "";
  let data: unknown;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else if (contentType.includes("image") || contentType.includes("pdf")) {
    data = await response.blob();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Request failed with status ${response.status}`;
    throw new APIError(message, response.status, data);
  }

  return data as TRes;
}

// ─── Typed Query Function ──────────────────────────────────────────
/**
 * Execute a typed API route with path params, query params, and body.
 */
export async function query<TRes, TBody>(
  route: ApiRoute<TRes, TBody>,
  options?: {
    pathParams?: Record<string, string>;
    queryParams?: QueryParams;
    body?: TBody;
    signal?: AbortSignal;
  },
): Promise<TRes> {
  let path = route.path;

  // Interpolate path params: {facility_id} → actual value
  if (options?.pathParams) {
    for (const [key, value] of Object.entries(options.pathParams)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value));
    }
  }

  // Add query string
  if (options?.queryParams) {
    const filtered = Object.fromEntries(
      Object.entries(options.queryParams).filter(
        ([, v]) => v !== undefined && v !== null,
      ),
    ) as Record<string, string | number | boolean>;
    path += queryString(filtered);
  }

  return request<TRes>(path, {
    method: route.method ?? "GET",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  });
}
