import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";

import type {
  ValueSetCreate,
  ValueSetLookupRequest,
  ValueSetLookupResponse,
  ValueSetRead,
  ValueSetUpdate,
} from "./valueset";

export default {
  list: {
    path: "/api/v1/valueset/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<ValueSetRead>>(),
  },

  create: {
    path: "/api/v1/valueset/",
    method: HttpMethod.POST,
    TBody: Type<ValueSetCreate>(),
    TRes: Type<ValueSetRead>(),
  },

  get: {
    path: "/api/v1/valueset/{slug}/",
    method: HttpMethod.GET,
    TRes: Type<ValueSetRead>(),
  },

  update: {
    path: "/api/v1/valueset/{slug}/",
    method: HttpMethod.PUT,
    TBody: Type<ValueSetUpdate>(),
    TRes: Type<ValueSetRead>(),
  },

  lookupCode: {
    path: "/api/v1/valueset/lookup_code/",
    method: HttpMethod.POST,
    TBody: Type<ValueSetLookupRequest>(),
    TRes: Type<ValueSetLookupResponse>(),
  },
} as const;
