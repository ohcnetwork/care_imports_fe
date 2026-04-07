import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";
import { LocationDetail, LocationWrite } from "./location";

// ─── Response Types ────────────────────────────────────────────────
export interface LocationReadMinimal {
  id: string;
  name: string;
  form: string;
  has_children: boolean;
  parent?: { id: string; name: string } | null;
}

// ─── API Routes ────────────────────────────────────────────────────
export default {
  list: {
    path: "/api/v1/facility/{facility_id}/location/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<LocationReadMinimal>>(),
  },

  create: {
    path: "/api/v1/facility/{facility_id}/location/",
    method: HttpMethod.POST,
    TRes: Type<LocationDetail>(),
    TBody: Type<LocationWrite>(),
  },

  addOrganization: {
    path: "/api/v1/facility/{facility_id}/location/{location_id}/organizations_add/",
    method: HttpMethod.POST,
    TRes: Type<LocationDetail>(),
    TBody: Type<{ organization: string }>(),
  },
} as const;
