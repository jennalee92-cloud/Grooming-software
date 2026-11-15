import "server-only";
import { Invalid, pastDate, text } from "@/lib/form-fields";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Reads the optional rabies fields from the add-pet forms. Returns null
// when they were left blank.
export function parseRabies(fd: FormData) {
  const givenRaw = text(fd, "rabiesGivenOn");
  const expiresOn = text(fd, "rabiesExpiresOn");
  if (!givenRaw && !expiresOn) return null;

  if (!expiresOn) throw new Invalid("Enter when the rabies vaccine expires, or clear the date given.");
  if (!DAY.test(expiresOn) || expiresOn < "1990-01-01" || expiresOn > "2100-12-31") throw new Invalid("Enter the rabies expiry date.");
  const givenOn = givenRaw ? pastDate(givenRaw, "1990-01-01", "The rabies date given can't be in the future.") : null;
  if (givenOn && expiresOn < givenOn) throw new Invalid("The rabies expiry date can't be before the date given.");

  return { vaccine: "Rabies", given_on: givenOn, expires_on: expiresOn, verified: fd.get("rabiesVerified") === "on" };
}
