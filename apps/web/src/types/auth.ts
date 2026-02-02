/**
 * Authentication types.
 * Mirrors backend: agentforge_api/auth/models.py
 */

/**
 * User roles with hierarchical permissions.
 */
export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

/**
 * Role hierarchy for permission checks.
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Authentication context from JWT.
 */
export interface AuthContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: Role;
  readonly exp: number; // Unix timestamp
}

/**
 * User session info.
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly tenantId: string;
}

/**
 * Check if user has at least the required role.
 */
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can write (create/edit).
 */
export function canWrite(role: Role): boolean {
  return hasRole(role, "MEMBER");
}

/**
 * Check if user is admin or above.
 */
export function isAdminOrAbove(role: Role): boolean {
  return hasRole(role, "ADMIN");
}
