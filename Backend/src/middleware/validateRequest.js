import { formatValidationIssues } from "../utils/validation.js";

export function validateRequest(schema, source = "query") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatValidationIssues(result.error.issues),
      });
    }

    req.validated = req.validated || {};
    req.validated[source] = result.data;
    return next();
  };
}

export default validateRequest;
