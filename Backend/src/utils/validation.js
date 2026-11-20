export function formatValidationIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "request",
    message: issue.message || "Invalid value.",
  }));
}
