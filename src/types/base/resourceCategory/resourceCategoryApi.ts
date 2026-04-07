import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";

import type { ResourceCategoryRead } from "./resourceCategory";

export interface ResourceCategoryCreate {
  title: string;
  slug_value: string;
  resource_type: string;
  resource_sub_type: string;
}

export default {
  list: {
    path: "/api/v1/facility/{facilityId}/resource_category/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<ResourceCategoryRead>>(),
  },

  create: {
    path: "/api/v1/facility/{facilityId}/resource_category/",
    method: HttpMethod.POST,
    TRes: Type<ResourceCategoryRead>(),
    TBody: Type<ResourceCategoryCreate>(),
  },

  upsert: {
    path: "/api/v1/facility/{facilityId}/resource_category/upsert/",
    method: HttpMethod.POST,
    TRes: Type<ResourceCategoryRead[]>(),
    TBody: Type<{ datapoints: ResourceCategoryCreate[] }>(),
  },
} as const;
