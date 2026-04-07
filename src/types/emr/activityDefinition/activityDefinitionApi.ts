import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";

import type {
  ActivityDefinitionCreateSpec,
  ActivityDefinitionReadSpec,
  ActivityDefinitionUpsertRequest,
} from "./activityDefinition";

export default {
  list: {
    path: "/api/v1/facility/{facilityId}/activity_definition/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<ActivityDefinitionReadSpec>>(),
  },

  get: {
    path: "/api/v1/facility/{facilityId}/activity_definition/{activityDefinitionSlug}/",
    method: HttpMethod.GET,
    TRes: Type<ActivityDefinitionReadSpec>(),
  },

  create: {
    path: "/api/v1/facility/{facilityId}/activity_definition/",
    method: HttpMethod.POST,
    TBody: Type<ActivityDefinitionCreateSpec>(),
    TRes: Type<ActivityDefinitionReadSpec>(),
  },

  update: {
    path: "/api/v1/facility/{facilityId}/activity_definition/{activityDefinitionSlug}/",
    method: HttpMethod.PUT,
    TBody: Type<ActivityDefinitionCreateSpec>(),
    TRes: Type<ActivityDefinitionReadSpec>(),
  },

  upsert: {
    path: "/api/v1/facility/{facilityId}/activity_definition/upsert/",
    method: HttpMethod.POST,
    TBody: Type<ActivityDefinitionUpsertRequest>(),
    TRes: Type<void>(),
  },
} as const;
