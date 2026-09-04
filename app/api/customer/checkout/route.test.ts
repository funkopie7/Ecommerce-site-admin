import { beforeEach, expect, it, vi } from "vitest";

const { customerFromRequest, pricedCart, createOrderFromCart, sendOrderConfirmation, findFirst } = vi.hoisted(() => ({
  customerFromRequest: vi.fn(),
  pricedCart: vi.fn(),
  createOrderFromCart: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  findFirst: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ customerFromRequest }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation }));
vi.mock("@/lib/createOrder", async (importOriginal) => ({ ...(await importOriginal<object>()), pricedCart, createOrderFromCart }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    address: { findFirst },
    $transaction: (fn: (tx: unknown) => unknown) => fn({}),
  },
}));
import { POST } from "./route";

const post = (body: unknown) => POST({ json: async () => body } as never);

beforeEach(() => {
  vi.clearAllMocks();
  customerFromRequest.mockResolvedValue({ customerId: "cust1" });
  findFirst.mockResolvedValue({ id: "addr1" });
  pricedCart.mockResolvedValue({ total: 0, discount: 429600, couponCode: "ANSH" });
  createOrderFromCart.mockResolvedValue({ id: "order1", number: "FP-1", total: 0 });
  sendOrderConfirmation.mockResolvedValue(true);
});

it("places an order when a coupon has taken the total to zero", async () => {
  const response = await post({ addressId: "addr1", couponCode: "ANSH" });
  expect(response.status).toBe(201);
  expect(createOrderFromCart).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ paymentStatus: "PAID" }));
  expect(sendOrderConfirmation).toHaveBeenCalledWith("order1");
});

/* The hole this route used to be: it created a confirmed, fully-paid order
   for any cart at all, with no payment involved. */
it("refuses a cart that actually costs money", async () => {
  pricedCart.mockResolvedValue({ total: 429600, discount: 0, couponCode: null });
  const response = await post({ addressId: "addr1" });
  expect(response.status).toBe(400);
  expect(createOrderFromCart).not.toHaveBeenCalled();
  expect(sendOrderConfirmation).not.toHaveBeenCalled();
});

it("refuses even a one-paisa cart, so nothing payable slips through", async () => {
  pricedCart.mockResolvedValue({ total: 1, discount: 0, couponCode: null });
  expect((await post({ addressId: "addr1" })).status).toBe(400);
  expect(createOrderFromCart).not.toHaveBeenCalled();
});

it("requires a session", async () => {
  customerFromRequest.mockResolvedValue(null);
  expect((await post({ addressId: "addr1" })).status).toBe(401);
  expect(pricedCart).not.toHaveBeenCalled();
});

it("rejects an address belonging to someone else", async () => {
  findFirst.mockResolvedValue(null);
  expect((await post({ addressId: "addr-of-another-customer" })).status).toBe(400);
  expect(createOrderFromCart).not.toHaveBeenCalled();
});

it("no longer accepts the old COD payload shape as a free order", async () => {
  pricedCart.mockResolvedValue({ total: 500000, discount: 0, couponCode: null });
  const response = await post({ addressId: "addr1", paymentMethod: "COD" });
  expect(response.status).toBe(400);
  expect(createOrderFromCart).not.toHaveBeenCalled();
});
