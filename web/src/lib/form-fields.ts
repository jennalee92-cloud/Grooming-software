// Reading and checking submitted form fields in server actions.
// Each limit passed in should match the database's own check.

export class Invalid extends Error {}

export const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

// Everything the person typed, to refill the form if it's rejected.
export function snapshot(fd: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function optional(fd: FormData, name: string, max: number, label: string) {
  const value = text(fd, name);
  if (value.length > max) throw new Invalid(`Keep ${label} under ${max} characters.`);
  return value || null;
}

export function required(fd: FormData, name: string, max: number, label: string) {
  const value = optional(fd, name, max, label);
  if (!value) throw new Invalid(`Enter ${label}.`);
  return value;
}

export function weightLbs(fd: FormData, name: string) {
  const raw = text(fd, name);
  if (!raw) return null;
  const weight = Number(raw);
  if (!Number.isFinite(weight) || weight <= 0 || weight >= 400) {
    throw new Invalid("Enter a weight in pounds between 0 and 400, or leave it blank.");
  }
  return Math.round(weight * 10) / 10;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// A YYYY-MM-DD date no earlier than `earliest` and no later than tomorrow.
export function pastDate(value: string, earliest: string, message: string) {
  const tomorrow = isoDay(new Date(Date.now() + 86_400_000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < earliest || value > tomorrow) throw new Invalid(message);
  return value;
}
