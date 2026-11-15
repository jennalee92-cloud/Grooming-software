// The database functions raise plain-language messages with these codes.
// Anything else is unexpected, so show a generic message instead of
// internal details.
const USER_FACING_CODES = new Set(["22023", "23505", "42501", "P0001", "P0002"]);

export function userMessage(error: { code?: string; message: string }) {
  if (error.code && USER_FACING_CODES.has(error.code)) return error.message;
  console.error("Unexpected database error", error);
  return "Something went wrong. Try again, and if it keeps happening, let us know.";
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
