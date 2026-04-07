// ─── Query Params ──────────────────────────────────────────────────
type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type QueryParams = Record<string, QueryParamValue>;

// ─── API Route Definition ──────────────────────────────────────────
export interface ApiRoute<TData, TBody = unknown> {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  TRes: TData;
  TBody?: TBody;
  noAuth?: boolean;
}

// ─── Path Params Extraction ────────────────────────────────────────
type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}{${infer Param}}${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : never;

export type PathParams<T extends string> = {
  [_ in ExtractRouteParams<T>]: string;
};

// ─── API Call Options ──────────────────────────────────────────────
export interface ApiCallOptions<Route extends ApiRoute<unknown, unknown>> {
  pathParams?: PathParams<Route["path"]>;
  queryParams?: QueryParams;
  body?: Route["TBody"];
  silent?: boolean;
  signal?: AbortSignal;
}

// ─── Paginated Response ────────────────────────────────────────────
export interface PaginatedResponse<TItem> {
  count: number;
  next: string | null;
  previous: string | null;
  results: TItem[];
}

// ─── Phantom Type Utility ──────────────────────────────────────────
/**
 * Creates a phantom type marker for compile-time type inference.
 */
export function Type<T>(): T {
  return {} as T;
}

// ─── HTTP Method Enum ──────────────────────────────────────────────
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}
