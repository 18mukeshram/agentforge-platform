// validation/types.ts

import type { NodeId, EdgeId } from "../types";

/**
 * Categories of validation errors.
 */
export type ValidationErrorCode =
  // Structural (S1-S5)
  | "CYCLE_DETECTED"
  | "INVALID_EDGE_REFERENCE"
  | "DUPLICATE_EDGE"
  | "NO_ENTRY_NODE"
  | "ORPHAN_NODE"
  // Semantic (M1-M2)
  | "TYPE_MISMATCH"
  | "MISSING_REQUIRED_INPUT";

/**
 * A single validation error with context.
 */
export interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;

  /** Affected node(s), if applicable */
  readonly nodeIds?: readonly NodeId[];

  /** Affected edge(s), if applicable */
  readonly edgeIds?: readonly EdgeId[];
}

/**
 * Result of validating a workflow.
 *
 * Either valid (no errors) or invalid (one or more errors).
 * Uses discriminated union for type-safe handling.
 */
export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly ValidationError[] };

/**
 * Helper to create a successful validation result.
 */
export function validResult(): ValidationResult {
  return { valid: true };
}

/**
 * Helper to create a failed validation result.
 */
export function invalidResult(
  errors: readonly ValidationError[],
): ValidationResult {
  return { valid: false, errors };
}
