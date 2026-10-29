import { ApiError, getProblemMessage } from "../problem-details";

describe("ApiError", () => {
  it("is an instance of Error", () => {
    const err = new ApiError(404, "Not found");
    expect(err).toBeInstanceOf(Error);
  });

  it("stores status and message", () => {
    const err = new ApiError(401, "Unauthorized");
    expect(err.status).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  it("stores optional problem details", () => {
    const problem = { detail: "Token expired", status: 401 };
    const err = new ApiError(401, "Unauthorized", problem);
    expect(err.problem).toEqual(problem);
  });

  it("problem is undefined when not provided", () => {
    const err = new ApiError(500, "Server error");
    expect(err.problem).toBeUndefined();
  });
});

describe("getProblemMessage", () => {
  it("returns the error message when there are no issues", () => {
    const err = new ApiError(400, "Bad request");
    expect(getProblemMessage(err)).toBe("Bad request");
  });

  it("returns the error message when problems.errors is empty", () => {
    const err = new ApiError(400, "Bad request", { errors: [] });
    expect(getProblemMessage(err)).toBe("Bad request");
  });

  it("joins string issues with ' | '", () => {
    const err = new ApiError(422, "Validation error", {
      errors: ["email is invalid", "password too short"],
    });
    expect(getProblemMessage(err)).toBe("email is invalid | password too short");
  });

  it("formats field+message object issues", () => {
    const err = new ApiError(422, "Validation error", {
      errors: [{ field: "email", message: "is invalid" }],
    });
    expect(getProblemMessage(err)).toBe("email: is invalid");
  });

  it("falls back to 'Invalid field' for empty object issues", () => {
    const err = new ApiError(422, "Validation error", {
      errors: [{}],
    });
    expect(getProblemMessage(err)).toBe("Invalid field");
  });

  it("uses message-only object issues", () => {
    const err = new ApiError(422, "Validation error", {
      errors: [{ message: "required" }],
    });
    expect(getProblemMessage(err)).toBe("required");
  });

  it("mixes string and object issues", () => {
    const err = new ApiError(422, "Validation error", {
      errors: ["global error", { field: "email", message: "invalid" }],
    });
    expect(getProblemMessage(err)).toBe("global error | email: invalid");
  });
});
