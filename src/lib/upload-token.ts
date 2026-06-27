import { randomBytes } from "crypto";

export const UPLOAD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dney

/** Sluchajnyj hex-token (~24 bajta = 48 hex-simvolov). */
export function generateUploadToken(): string {
  return randomBytes(24).toString("hex");
}

/** Istek li token na moment now. */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Publichnyj URL mobilnoj stranicy zagruzki po tokenu. */
export function uploadUrlForToken(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return `${base}/u/${token}`;
}
