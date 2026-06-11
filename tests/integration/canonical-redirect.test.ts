import { describe, expect, it } from "vitest";
import {
  resolveCanonicalRedirect,
  CANONICAL_HOST,
} from "../../apps/web/src/lib/canonical";

// REQ-CORE-002: apex ai-oss.net MUST 308-redirect to www.ai-oss.net.
describe("apex → www canonical redirect", () => {
  it("redirects the bare apex host with HTTP 308 to the www host", () => {
    const result = resolveCanonicalRedirect(
      "ai-oss.net",
      "http://ai-oss.net/some/path?q=1",
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(308);
    expect(result?.location).toBe(`https://${CANONICAL_HOST}/some/path?q=1`);
  });

  it("redirects the apex host even when a port is present", () => {
    const result = resolveCanonicalRedirect("ai-oss.net:443", "https://ai-oss.net/");
    expect(result?.status).toBe(308);
    expect(result?.location).toBe(`https://${CANONICAL_HOST}/`);
  });

  it("does NOT redirect the canonical www host", () => {
    expect(
      resolveCanonicalRedirect("www.ai-oss.net", "https://www.ai-oss.net/"),
    ).toBeNull();
  });

  it("does NOT redirect local/preview hosts", () => {
    expect(resolveCanonicalRedirect("localhost:3000", "http://localhost:3000/")).toBeNull();
    expect(
      resolveCanonicalRedirect("ai-oss-xyz.vercel.app", "https://ai-oss-xyz.vercel.app/"),
    ).toBeNull();
  });

  it("returns null when no host header is present", () => {
    expect(resolveCanonicalRedirect(null, "https://ai-oss.net/")).toBeNull();
  });
});
