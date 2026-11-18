import { describe, expect, it } from "vitest";
import { getRedirectUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../next.config";

describe("Legacy account URLs", () => {
  it.each(["/security", "/settings/security", "/operations", "/settings/profile"])(
    "redirects %s directly to My Profile",
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://lumina.example${path}`,
        nextConfig,
      });
      expect(response.status).toBe(308);
      expect(getRedirectUrl(response)).toBe("https://lumina.example/profile");
    },
  );

  it("leaves My Profile available without a redirect loop", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://lumina.example/profile",
      nextConfig,
    });
    expect(response.status).toBe(200);
    expect(getRedirectUrl(response)).toBeNull();
  });
});
