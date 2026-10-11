import { describe, expect, it } from "vitest";
import { enquirySchema, isLikelySpam } from "@deetech/shared-types";

/**
 * The enquiry schema is shared by the Next.js server action and the Express
 * route that lands on Day 14. It is tested here because this workspace owns
 * the test runner, and because these rules are a control rather than a
 * convenience — the browser's copy of them can be bypassed entirely.
 */

const valid = {
  name: "Priya Sharma",
  email: "priya@example.com",
  subject: "New marketing website",
  message:
    "We need a new marketing site with a blog and a contact form, roughly ten pages, live before the end of the quarter.",
};

describe("enquirySchema", () => {
  it("accepts a well-formed enquiry", () => {
    const result = enquirySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace rather than storing it", () => {
    const result = enquirySchema.parse({ ...valid, name: "  Priya Sharma  " });
    expect(result.name).toBe("Priya Sharma");
  });

  it.each([
    ["name", "A"],
    ["subject", "hi"],
    ["message", "too short"],
  ])("rejects %s when it is below the minimum length", (field, value) => {
    const result = enquirySchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
  });

  it.each(["not-an-email", "missing@tld", "@example.com", ""])(
    "rejects the malformed email %j",
    (email) => {
      expect(enquirySchema.safeParse({ ...valid, email }).success).toBe(false);
    },
  );

  it("rejects a message longer than the 5000 character limit", () => {
    const result = enquirySchema.safeParse({
      ...valid,
      message: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("treats company and phone as optional, including as empty strings", () => {
    expect(enquirySchema.safeParse({ ...valid, company: "", phone: "" }).success).toBe(
      true,
    );
    expect(enquirySchema.safeParse(valid).success).toBe(true);
  });

  it("reports every invalid field at once, not just the first", () => {
    const result = enquirySchema.safeParse({
      name: "A",
      email: "nope",
      subject: "x",
      message: "short",
    });
    expect(result.success).toBe(false);
    const fields = new Set(result.error!.issues.map((i) => i.path.join(".")));
    expect(fields).toEqual(new Set(["name", "email", "subject", "message"]));
  });
});

describe("honeypot", () => {
  it("does not make a filled honeypot a validation error", () => {
    // If this failed validation, a bot would get a distinguishable response
    // it could tune against, and a real user would be shown an error pointing
    // at a field they cannot see.
    const result = enquirySchema.safeParse({
      ...valid,
      website: "http://spam.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("flags a filled honeypot as spam", () => {
    const parsed = enquirySchema.parse({
      ...valid,
      website: "http://spam.example.com",
    });
    expect(isLikelySpam(parsed)).toBe(true);
  });

  it("treats whitespace-only as empty, and an absent field as not spam", () => {
    expect(isLikelySpam(enquirySchema.parse({ ...valid, website: "   " }))).toBe(false);
    expect(isLikelySpam(enquirySchema.parse({ ...valid, website: "" }))).toBe(false);
    expect(isLikelySpam(enquirySchema.parse(valid))).toBe(false);
  });
});
