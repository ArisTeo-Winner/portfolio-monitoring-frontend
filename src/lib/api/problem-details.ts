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

// User-facing fallback copy by HTTP status. Deliberately status-based rather
// than keyed off problem.errorCode or problem.detail/title: the backend's
// detail/title text is meant for logs/support, not end users — it's often in
// English and sometimes leaks internal exception messages for non-JSON error
// pages — so every call site should render this instead of the raw backend
// text.
const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
  400: "La solicitud contiene datos inválidos.",
  401: "No fue posible verificar tus credenciales.",
  403: "No tienes permisos para realizar esta acción.",
  404: "No se encontró el recurso solicitado.",
  409: "Ya existe un registro con esos datos.",
  422: "La solicitud contiene datos inválidos.",
  429: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
};
const DEFAULT_ERROR_MESSAGE = "No fue posible completar la solicitud. Intenta de nuevo.";

export function localizedErrorMessage(status: number): string {
  return STATUS_FALLBACK_MESSAGES[status] ?? DEFAULT_ERROR_MESSAGE;
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
