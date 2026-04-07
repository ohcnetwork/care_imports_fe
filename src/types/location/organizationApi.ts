import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";
import { FacilityOrganizationRead } from "./facilityOrganization";

// ─── Request Types ─────────────────────────────────────────────────
export interface OrganizationCreate {
  name: string;
  description?: string;
  org_type: string;
  facility: string;
  parent?: string;
}

export interface OrganizationAddUser {
  user: string;
  role: string;
}

// ─── API Routes ────────────────────────────────────────────────────
export default {
  list: {
    path: "/api/v1/facility/{facility_id}/organizations/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<FacilityOrganizationRead>>(),
  },

  create: {
    path: "/api/v1/facility/{facility_id}/organizations/",
    method: HttpMethod.POST,
    TRes: Type<{ id: string }>(),
    TBody: Type<OrganizationCreate>(),
  },

  addUser: {
    path: "/api/v1/facility/{facility_id}/organizations/{organization_id}/users/",
    method: HttpMethod.POST,
    TRes: Type<void>(),
    TBody: Type<OrganizationAddUser>(),
  },
} as const;
