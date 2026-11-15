// A calendar day (YYYY-MM-DD) as "Thu, Nov 14, 2026". No time zone shift.
export function dayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

// Dates are formatted on the server, in the business's time zone when known.
export function shortDate(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
}
