import { expect, it } from "vitest";
import { createAdminSession, adminSessionValid } from "./auth";

it("creates and validates an admin session token", async () => {
  const token = await createAdminSession();
  expect(await adminSessionValid(token)).toBe(true);
});

it("rejects a garbage token", async () => {
  expect(await adminSessionValid("not-a-real-token")).toBe(false);
});
