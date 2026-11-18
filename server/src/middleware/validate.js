const HttpError = require('../utils/httpError');

// Validates req.body against a zod schema and replaces it with the clean data
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!fields[key]) fields[key] = issue.message;
      }
      return next(new HttpError(400, 'Please correct the highlighted fields.', fields));
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
