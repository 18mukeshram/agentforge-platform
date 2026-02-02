/**
 * API error handling.
 */

import type { ApiErrorResponse } from "@/types";

/**
 * Custom API error class.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: ApiErrorResponse["details"];
  public readonly requestId: string | null;

  constructor(
    message: string,
    status: number,
    code: string = "UNKNOWN_ERROR",
    details: ApiErrorResponse["details"] = [],
    requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /**
   * Check if error is a specific type.
   */
  is(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if error is a client error (4xx).
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx).
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if error is unauthorized.
   */
  isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Check if error is forbidden.
   */
  isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * Check if error is not found.
   */
  isNotFound(): boolean {
    return this.status === 404;
  }
}

/**
 * Parse API error response.
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  let errorData: ApiErrorResponse | null = null;

  try {
    errorData = await response.json();
  } catch {
    // Response is not JSON
  }

  if (errorData) {
    return new ApiError(
      errorData.message,
      response.status,
      errorData.code,
      errorData.details,
      errorData.requestId,
    );
  }

  // Fallback for non-JSON responses
  return new ApiError(
    response.statusText || "An error occurred",
    response.status,
    "UNKNOWN_ERROR",
  );
}

/**
 * Check if error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
