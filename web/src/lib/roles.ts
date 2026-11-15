import type { Database } from "@/lib/supabase/database.types";

// Role names and descriptions. Safe to import from browser components.

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  groomer: "Groomer",
  bather: "Bather",
  front_desk: "Front desk",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: "Full control of the business, its team, and every location.",
  admin: "Manages the team and every location. Can't change the owner or other admins.",
  manager: "Leads the team at the locations you choose.",
  front_desk: "Greets clients and handles check-in at the locations you choose.",
  groomer: "Grooms pets and records visits at the locations you choose.",
  bather: "Bathes and preps pets at the locations you choose.",
};

// Roles someone can be invited as, in the order shown in forms.
export const INVITABLE_ROLES: MemberRole[] = ["admin", "manager", "front_desk", "groomer", "bather"];

export const canManageTeam = (role: MemberRole) => role === "owner" || role === "admin";

// Roles the caller may hand out. Only the owner can grant admin.
export const assignableRoles = (callerRole: MemberRole) =>
  INVITABLE_ROLES.filter((r) => r !== "admin" || callerRole === "owner");
