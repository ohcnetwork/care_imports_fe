import { HttpMethod, PaginatedResponse, Type } from "@/apis/types";
import { RoleRead } from "./role";
import { UserReadMinimal } from "./user";

// ─── Request/Response Types ────────────────────────────────────────
export interface UserCreate {
  user_type: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  gender: string;
  password: string;
  phone_number: string;
  geo_organization?: string;
  role_orgs: string[];
}

export interface CurrentUser {
  username: string;
  facilities: { id: string; name: string }[];
}

// ─── API Routes ────────────────────────────────────────────────────
export default {
  currentUser: {
    path: "/api/v1/users/getcurrentuser/",
    method: HttpMethod.GET,
    TRes: Type<CurrentUser>(),
  },

  get: {
    path: "/api/v1/users/{username}/",
    method: HttpMethod.GET,
    TRes: Type<UserReadMinimal>(),
  },

  create: {
    path: "/api/v1/users/",
    method: HttpMethod.POST,
    TRes: Type<UserReadMinimal>(),
    TBody: Type<UserCreate>(),
  },
} as const;

// ─── Role API Routes ───────────────────────────────────────────────
export const roleApi = {
  list: {
    path: "/api/v1/role/",
    method: HttpMethod.GET,
    TRes: Type<PaginatedResponse<RoleRead>>(),
  },
} as const;
