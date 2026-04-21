export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errorCode?: string;
  traceId?: string;
  errors?: Array<string | { field?: string; message?: string }>;
};

export class ApiError extends Error {
  status: number;
  problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.status = status;
    this.problem = problem;
  }
}

export function getProblemMessage(error: ApiError) {
  const issues = error.problem?.errors ?? [];

  if (issues.length > 0) {
    return issues
      .map((issue) => {
        if (typeof issue === "string") {
          return issue;
        }
        if (issue.field && issue.message) {
          return `${issue.field}: ${issue.message}`;
        }
        return issue.message || issue.field || "Invalid field";
      })
      .join(" | ");
  }

  return error.message;
}
