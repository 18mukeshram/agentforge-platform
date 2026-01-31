// validation/index.ts

import type { Workflow, AgentId, AgentDefinition } from "../types";
import type { ValidationResult, ValidationError } from "./types";
import { validResult, invalidResult } from "./types";
import type { AgentRegistry } from "./semantic";

// Structural validators
import {
  validateEdgeReferences,
  validateNoDuplicateEdges,
  validateHasEntryNode,
  validateNoOrphans,
  validateNoCycles,
} from "./structural";

// Semantic validators
import { validateTypeCompatibility, validateRequiredInputs } from "./semantic";

// Re-export types
export type { ValidationResult, ValidationError, AgentRegistry };
export { validResult, invalidResult } from "./types";
export type { TopologicalSortResult } from "./topological";
export {
  topologicalSort,
  getExecutionOrder,
  computeExecutionLevels,
} from "./topological";

// Re-export graph utilities (useful for execution engine)
export {
  buildAdjacencyList,
  buildReverseAdjacencyList,
  computeInDegrees,
  findEntryNodes,
  findExitNodes,
} from "./graph";

/**
 * Options for workflow validation.
 */
export interface ValidateWorkflowOptions {
  /**
   * Agent registry for semantic validation.
   * If not provided, semantic validation is skipped.
   */
  readonly agentRegistry?: AgentRegistry;

  /**
   * If true, stop at first error category.
   * If false, collect all errors.
   * Default: false
   */
  readonly failFast?: boolean;
}

/**
 * Validate a workflow against all invariants.
 *
 * Runs validations in order:
 * 1. Structural (S1-S5) - must pass before semantic
 * 2. Semantic (M1-M2) - requires agent registry
 *
 * Returns combined result with all errors.
 */
export function validateWorkflow(
  workflow: Workflow,
  options: ValidateWorkflowOptions = {},
): ValidationResult {
  const { agentRegistry, failFast = false } = options;
  const allErrors: ValidationError[] = [];

  // Helper to collect errors and check for early exit
  function collectErrors(result: ValidationResult): boolean {
    if (!result.valid) {
      allErrors.push(...result.errors);
      if (failFast) return true; // Signal early exit
    }
    return false;
  }

  // === Structural Validation (order matters) ===

  // S2: Edge references must be valid first
  if (collectErrors(validateEdgeReferences(workflow))) {
    return invalidResult(allErrors);
  }

  // S3: No duplicate edges
  if (collectErrors(validateNoDuplicateEdges(workflow))) {
    return invalidResult(allErrors);
  }

  // S4: Must have entry node
  if (collectErrors(validateHasEntryNode(workflow))) {
    return invalidResult(allErrors);
  }

  // S1: No cycles (requires valid edges)
  if (collectErrors(validateNoCycles(workflow))) {
    return invalidResult(allErrors);
  }

  // S5: No orphans (requires acyclic graph)
  if (collectErrors(validateNoOrphans(workflow))) {
    return invalidResult(allErrors);
  }

  // Exit if structural errors and no semantic validation requested
  if (allErrors.length > 0 && !agentRegistry) {
    return invalidResult(allErrors);
  }

  // === Semantic Validation (requires agent registry) ===

  if (agentRegistry) {
    // M1: Type compatibility
    if (collectErrors(validateTypeCompatibility(workflow, agentRegistry))) {
      return invalidResult(allErrors);
    }

    // M2: Required inputs satisfied
    if (collectErrors(validateRequiredInputs(workflow, agentRegistry))) {
      return invalidResult(allErrors);
    }
  }

  // Return result
  return allErrors.length === 0 ? validResult() : invalidResult(allErrors);
}

/**
 * Quick structural-only validation.
 * Use for fast feedback during editing.
 */
export function validateWorkflowStructure(
  workflow: Workflow,
): ValidationResult {
  return validateWorkflow(workflow, {
    agentRegistry: undefined,
    failFast: false,
  });
}

/**
 * Full validation including semantics.
 * Use before execution.
 */
export function validateWorkflowFull(
  workflow: Workflow,
  agentRegistry: AgentRegistry,
): ValidationResult {
  return validateWorkflow(workflow, { agentRegistry, failFast: false });
}
