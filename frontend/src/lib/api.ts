export type ApiResponse<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("supplyquest_token");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    const error = payload.success ? { code: "REQUEST_FAILED", message: "Request failed." } : payload.error;
    throw new ApiError(error.code, error.message, response.status);
  }
  return payload.data;
}