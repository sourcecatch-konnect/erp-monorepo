export function normalizeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function createDuplicateError(field: string, message: string) {
  const error: Error & {
    statusCode?: number;
    details?: { fieldErrors: Record<string, string[]> };
  } = new Error(message);

  error.statusCode = 409;
  error.details = {
    fieldErrors: {
      [field]: [message],
    },
  };

  return error;
}
