import { cookies } from "next/headers";
import { WORKSPACE_COOKIE } from "@/lib/dal";

// Call only from server actions, after checking the person belongs to
// the business. The cookie picks which business is shown; it grants nothing.
export async function rememberWorkspace(organizationId: string) {
  (await cookies()).set(WORKSPACE_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
