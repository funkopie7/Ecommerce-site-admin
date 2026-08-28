import { expect, it, vi, beforeEach } from "vitest";
import { adminFetch, AdminApiError } from "./adminApi";
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
it("returns parsed json on success", async () => { (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "1" }) }); expect(await adminFetch("/api/admin/products")).toEqual({ id: "1" }); });
it("throws AdminApiError with the server message on failure", async () => { (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, json: async () => ({ error: "Administrator access required" }) }); await expect(adminFetch("/api/admin/products")).rejects.toThrow(AdminApiError); });
