import { expect, it } from "vitest";
import { totalForItems } from "./checkout";

it("calculates a checkout total from item snapshots", () => expect(totalForItems([{ unitPrice: 129900, quantity: 1 }, { unitPrice: 45900, quantity: 2 }])).toBe(221700));
