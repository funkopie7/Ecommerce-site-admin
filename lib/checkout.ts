export type CheckoutLine = { unitPrice: number; quantity: number };
export const totalForItems = (items: CheckoutLine[]) => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
