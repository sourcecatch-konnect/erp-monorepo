export function normalizeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function createDuplicateError(
  field: string,
  message: string,
) {
  const error = new Error(message);

  (error as any).statusCode = 409;
  (error as any).details = {
    fieldErrors: {
      [field]: [message],
    },
  };

  return error;
}