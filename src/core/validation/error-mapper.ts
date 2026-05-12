import { ApiError, getProblemMessage } from "@/lib/api/problem-details";
import type { ZodError } from "zod";

export function mapApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return getProblemMessage(error) || fallback;
  }
  return fallback;
}

export function mapZodError(error: ZodError): string {
  return error.errors.map((issue) => issue.message).join(" · ");
}
