// Dates are formatted on the server, in the business's time zone when known.
export function shortDate(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
}
