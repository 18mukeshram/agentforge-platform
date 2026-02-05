/**
 * Centralized permission helpers for RBAC.
 * Maps roles to allowed actions with explicit denial reasons.
 */

import { type Role, hasRole, canWrite, isAdminOrAbove } from "@/types/auth";
import { useSessionStore } from "@/stores/session-store";

/**
 * Permission actions that can be checked.
 */
export type PermissionAction =
  | "workflow:run"
  | "workflow:resume"
  | "workflow:edit"
  | "workflow:delete"
  | "workflow:validate"
  | "workflow:save"
  | "execution:cancel"
  | "execution:view"
  | "admin:manage";

/**
 * Permission check result.
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Permission rules: maps actions to minimum required role.
 */
const PERMISSION_RULES: Record<PermissionAction, Role> = {
  "workflow:run": "MEMBER",
  "workflow:resume": "MEMBER",
  "workflow:edit": "MEMBER",
  "workflow:delete": "ADMIN",
  "workflow:validate": "VIEWER",
  "workflow:save": "MEMBER",
  "execution:cancel": "MEMBER",
  "execution:view": "VIEWER",
  "admin:manage": "ADMIN",
};

/**
 * Human-readable action names for error messages.
 */
const ACTION_NAMES: Record<PermissionAction, string> = {
  "workflow:run": "execute workflows",
  "workflow:resume": "resume executions",
  "workflow:edit": "edit workflows",
  "workflow:delete": "delete workflows",
  "workflow:validate": "validate workflows",
  "workflow:save": "save workflows",
  "execution:cancel": "cancel executions",
  "execution:view": "view executions",
  "admin:manage": "access admin features",
};

/**
 * Check if a role has permission for an action.
 */
export function checkPermission(
  role: Role,
  action: PermissionAction
): PermissionResult {
  const requiredRole = PERMISSION_RULES[action];
  const allowed = hasRole(role, requiredRole);

  if (allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `${role} role cannot ${ACTION_NAMES[action]}. Requires ${requiredRole} or higher.`,
  };
}

/**
 * Check multiple permissions at once.
 */
export function checkPermissions(
  role: Role,
  actions: PermissionAction[]
): Record<PermissionAction, PermissionResult> {
  const results: Record<string, PermissionResult> = {};
  for (const action of actions) {
    results[action] = checkPermission(role, action);
  }
  return results as Record<PermissionAction, PermissionResult>;
}

/**
 * Hook to access permissions for current user.
 */
export function usePermissions() {
  const user = useSessionStore((state) => state.user);
  const role = user?.role || "VIEWER";

  return {
    role,
    user,
    can: (action: PermissionAction) => checkPermission(role, action),
    canAll: (actions: PermissionAction[]) => checkPermissions(role, actions),
    canWrite: () => canWrite(role),
    isAdmin: () => isAdminOrAbove(role),
  };
}

/**
 * Get tooltip text for a disabled action.
 */
export function getPermissionTooltip(
  role: Role,
  action: PermissionAction
): string | undefined {
  const result = checkPermission(role, action);
  return result.allowed ? undefined : result.reason;
}

/**
 * Check if user is in read-only mode (VIEWER role).
 */
export function isReadOnly(role: Role): boolean {
  return role === "VIEWER";
}
