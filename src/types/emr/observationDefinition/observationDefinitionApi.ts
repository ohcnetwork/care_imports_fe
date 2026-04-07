import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";

import type {
  ObservationDefinitionCreateSpec,
  ObservationDefinitionReadSpec,
} from "./observationDefinition";

export interface ObservationDefinitionUpsertRequest {
  datapoints: (ObservationDefinitionCreateSpec & { id?: string })[];
}

export default {
  list: {
    path: "/api/v1/observation_definition/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<ObservationDefinitionReadSpec>>(),
  },

  get: {
    path: "/api/v1/observation_definition/{observationSlug}/",
    method: HttpMethod.GET,
    TRes: Type<ObservationDefinitionReadSpec>(),
  },

  create: {
    path: "/api/v1/observation_definition/",
    method: HttpMethod.POST,
    TRes: Type<ObservationDefinitionReadSpec>(),
    TBody: Type<ObservationDefinitionCreateSpec>(),
  },

  update: {
    path: "/api/v1/observation_definition/{observationSlug}/",
    method: HttpMethod.PUT,
    TRes: Type<ObservationDefinitionReadSpec>(),
    TBody: Type<ObservationDefinitionCreateSpec>(),
  },

  upsert: {
    path: "/api/v1/observation_definition/upsert/",
    method: HttpMethod.POST,
    TRes: Type<ObservationDefinitionReadSpec[]>(),
    TBody: Type<ObservationDefinitionUpsertRequest>(),
  },
} as const;
