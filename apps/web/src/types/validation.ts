/**
 * Validation types.
 * Mirrors backend: agentforge_api/models/validation.py
 */

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
  readonly nodeIds: string[];
  readonly edgeIds: string[];
}

/**
 * Result of validating a workflow.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ValidationError[];
  readonly executionOrder: string[] | null;
}
