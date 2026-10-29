/**
 * API の呼び出し。応答は zod のスキーマで確かめ、失敗は API の本文（{ error, code }）を持つ ApiError にする。
 * 画面は ApiError の message（API の文）をそのまま出す。
 */
import { z } from "zod";

export const NETWORK_ERROR_CODE = "network_error";
const INVALID_RESPONSE_CODE = "invalid_response";
const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;

const apiErrorBodySchema = z.object({ error: z.string(), code: z.string().optional() });

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(input: { status: number; message: string; code?: string }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
  }
}

export function isApiError(failure: unknown): failure is ApiError {
  return failure instanceof ApiError;
}

export function isUnauthorizedError(failure: unknown): boolean {
  return isApiError(failure) && failure.status === HTTP_UNAUTHORIZED;
}

export async function requestJson<Schema extends z.ZodType>(
  url: string,
  { schema, init }: { schema: Schema; init?: RequestInit },
): Promise<z.infer<Schema>> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", ...init });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError({ status: 0, code: NETWORK_ERROR_CODE, message: "Network request failed" });
  }
  const body = response.status === HTTP_NO_CONTENT ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsedError = apiErrorBodySchema.safeParse(body);
    throw parsedError.success
      ? new ApiError({ status: response.status, message: parsedError.data.error, code: parsedError.data.code })
      : new ApiError({ status: response.status, message: `HTTP ${response.status}` });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      status: response.status,
      code: INVALID_RESPONSE_CODE,
      message: `Unexpected response from ${url}: ${z.prettifyError(parsed.error)}`,
    });
  }
  return parsed.data;
}

export function jsonRequestInit(method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
