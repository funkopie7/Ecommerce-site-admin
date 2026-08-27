import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats paise as Indian rupees", () => expect(formatMoney(199900)).toBe("₹1,999.00"));
  it("formats a zero amount", () => expect(formatMoney(0)).toBe("₹0.00"));
});
