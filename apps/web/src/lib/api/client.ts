/**
 * API fetch client with authentication and error handling.
 */

import { API_CONFIG } from "./config";
import { ApiError, parseApiError } from "./errors";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

interface ApiClientConfig {
  getToken: () => string | null;
  onUnauthorized?: () => void;
}

let clientConfig: ApiClientConfig = {
  getToken: () => null,
};

/**
 * Configure the API client.
 */
export function configureApiClient(config: Partial<ApiClientConfig>): void {
  clientConfig = { ...clientConfig, ...config };
}

/**
 * Build URL with query parameters.
 */
function buildUrl(endpoint: string, params?: RequestOptions["params"]): string {
  const url = new URL(endpoint, API_CONFIG.baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Main fetch function with error handling and authentication.
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    params,
    timeout = API_CONFIG.timeout,
  } = options;

  // Build headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Add auth token if available
  const token = clientConfig.getToken();
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  // Build request
  const url = buildUrl(endpoint, params);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle errors
    if (!response.ok) {
      const error = await parseApiError(response);

      // Handle unauthorized
      if (error.isUnauthorized() && clientConfig.onUnauthorized) {
        clientConfig.onUnauthorized();
      }

      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse JSON response
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timeout", 408, "TIMEOUT");
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new ApiError("Network error", 0, "NETWORK_ERROR");
    }

    // Re-throw ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Unknown error
    throw new ApiError(
      error instanceof Error ? error.message : "Unknown error",
      0,
      "UNKNOWN_ERROR",
    );
  }
}

/**
 * API client methods.
 */
export const apiClient = {
  get: <T>(
    endpoint: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ) => fetchApi<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method">,
  ) => fetchApi<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method">,
  ) => fetchApi<T>(endpoint, { ...options, method: "PUT", body }),

  patch: <T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method">,
  ) => fetchApi<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(
    endpoint: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ) => fetchApi<T>(endpoint, { ...options, method: "DELETE" }),
};
