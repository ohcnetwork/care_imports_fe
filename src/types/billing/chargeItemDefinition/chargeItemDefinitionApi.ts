import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";

import type {
  ChargeItemDefinitionCreate,
  ChargeItemDefinitionRead,
} from "./chargeItemDefinition";

export default {
  list: {
    path: "/api/v1/facility/{facilityId}/charge_item_definition/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<ChargeItemDefinitionRead>>(),
  },

  get: {
    path: "/api/v1/facility/{facilityId}/charge_item_definition/{slug}/",
    method: HttpMethod.GET,
    TRes: Type<ChargeItemDefinitionRead>(),
  },

  create: {
    path: "/api/v1/facility/{facilityId}/charge_item_definition/",
    method: HttpMethod.POST,
    TRes: Type<ChargeItemDefinitionRead>(),
    TBody: Type<ChargeItemDefinitionCreate>(),
  },

  update: {
    path: "/api/v1/facility/{facilityId}/charge_item_definition/{slug}/",
    method: HttpMethod.PUT,
    TRes: Type<ChargeItemDefinitionRead>(),
    TBody: Type<ChargeItemDefinitionCreate>(),
  },
} as const;
