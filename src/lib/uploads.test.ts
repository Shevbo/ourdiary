import { describe, it, expect } from "vitest";
import { isExpired, generateUploadToken, uploadUrlForToken } from "@/lib/upload-token";
import { kindFromMime } from "@/lib/uploads";

describe("upload token expiry", () => {
  const now = new Date("2026-06-27T12:00:00.000Z");

  it("treats a future expiry as valid", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(isExpired(future, now)).toBe(false);
  });

  it("treats a past expiry as expired", () => {
    const past = new Date(now.getTime() - 60_000);
    expect(isExpired(past, now)).toBe(true);
  });

  it("treats exact-now expiry as expired (boundary)", () => {
    expect(isExpired(new Date(now.getTime()), now)).toBe(true);
  });
});

describe("generateUploadToken", () => {
  it("returns 48 hex chars (~24 bytes)", () => {
    const t = generateUploadToken();
    expect(t).toMatch(/^[0-9a-f]{48}$/);
  });

  it("returns unique values", () => {
    expect(generateUploadToken()).not.toBe(generateUploadToken());
  });
});

describe("uploadUrlForToken", () => {
  it("builds /u/<token> from NEXT_PUBLIC_APP_URL without double slash", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://diary.example.com/";
    expect(uploadUrlForToken("abc")).toBe("https://diary.example.com/u/abc");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});

describe("kindFromMime", () => {
  it("maps image/* to photo", () => {
    expect(kindFromMime("image/jpeg")).toBe("photo");
    expect(kindFromMime("IMAGE/PNG")).toBe("photo");
  });

  it("maps video/* to video", () => {
    expect(kindFromMime("video/mp4")).toBe("video");
    expect(kindFromMime("video/quicktime")).toBe("video");
  });

  it("returns null for unknown types", () => {
    expect(kindFromMime("application/pdf")).toBeNull();
    expect(kindFromMime("")).toBeNull();
  });
});
