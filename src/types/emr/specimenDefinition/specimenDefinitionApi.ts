import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";

import type {
  SpecimenDefinitionCreate,
  SpecimenDefinitionRead,
} from "./specimenDefinition";

export interface SpecimenDefinitionUpsertRequest {
  datapoints: (SpecimenDefinitionCreate & { id?: string })[];
}

export default {
  list: {
    path: "/api/v1/facility/{facilityId}/specimen_definition/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<SpecimenDefinitionRead>>(),
  },

  get: {
    path: "/api/v1/facility/{facilityId}/specimen_definition/{specimenSlug}/",
    method: HttpMethod.GET,
    TRes: Type<SpecimenDefinitionRead>(),
  },

  create: {
    path: "/api/v1/facility/{facilityId}/specimen_definition/",
    method: HttpMethod.POST,
    TRes: Type<SpecimenDefinitionRead>(),
    TBody: Type<SpecimenDefinitionCreate>(),
  },

  update: {
    path: "/api/v1/facility/{facilityId}/specimen_definition/{specimenSlug}/",
    method: HttpMethod.PUT,
    TRes: Type<SpecimenDefinitionRead>(),
    TBody: Type<SpecimenDefinitionCreate>(),
  },

  upsert: {
    path: "/api/v1/facility/{facilityId}/specimen_definition/upsert/",
    method: HttpMethod.POST,
    TRes: Type<SpecimenDefinitionRead[]>(),
    TBody: Type<SpecimenDefinitionUpsertRequest>(),
  },
} as const;
