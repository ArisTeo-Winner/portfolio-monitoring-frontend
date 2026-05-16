import { z } from "zod";
import { mapApiError, mapZodError } from "../error-mapper";
import { ApiError } from "@/lib/api/problem-details";

describe("mapApiError", () => {
  it("returns the ApiError message when error is an ApiError", () => {
    const err = new ApiError(400, "Invalid request");
    expect(mapApiError(err, "fallback")).toBe("Invalid request");
  });

  it("returns the fallback for a generic Error", () => {
    expect(mapApiError(new Error("generic"), "fallback")).toBe("fallback");
  });

  it("returns the fallback for a non-error value", () => {
    expect(mapApiError(null, "fallback")).toBe("fallback");
    expect(mapApiError("string error", "fallback")).toBe("fallback");
    expect(mapApiError(undefined, "fallback")).toBe("fallback");
  });
});

describe("mapZodError", () => {
  it("returns a single error message", () => {
    const schema = z.object({ name: z.string().min(1, "required") });
    const result = schema.safeParse({ name: "" });
    if (result.success) throw new Error("Expected failure");
    expect(mapZodError(result.error)).toBe("required");
  });

  it("joins multiple error messages with ' · '", () => {
    const schema = z.object({
      a: z.string().min(1, "a required"),
      b: z.number({ required_error: "b required" }),
    });
    const result = schema.safeParse({ a: "", b: undefined });
    if (result.success) throw new Error("Expected failure");
    const message = mapZodError(result.error);
    expect(message).toContain("a required");
    expect(message).toContain("b required");
    expect(message).toContain(" · ");
  });
});
