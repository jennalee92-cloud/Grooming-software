import { headers } from "next/headers";

// The address people reach this app at, for links we hand out.
export async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export const inviteLink = (origin: string, email: string) =>
  `${origin}/signup?email=${encodeURIComponent(email)}`;
