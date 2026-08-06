import crypto from "crypto";

export function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = crypto.randomBytes(8);
  const code = Array.from(rand)
    .map((byte) => chars[byte % chars.length])
    .join("");
  return `ATS-${code}`;
}