"use client";

import * as React from "react";

import { adminFetch } from "@/lib/adminApi";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUSES, type Order, type OrderStatus, type Product } from "@/components/admin/types";

type CustomerHit = { id: string; name: string; email: string; phone: string | null };

/**
 * For a sale conducted in person — over the phone, at a pop-up, cash in
 * hand. Either an existing registered customer or a walk-in's name and
 * phone; the products and quantities straight off the shelf; and how much
 * was actually paid right now, which can be less than the total.
 */
export function ManualOrderDialog({
  open,
  onOpenChange,
  products,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onCreated: (order: Order) => void;
}) {
  const [mode, setMode] = React.useState<"existing" | "walkin">("walkin");
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [customerHits, setCustomerHits] = React.useState<CustomerHit[]>([]);
  const [customer, setCustomer] = React.useState<CustomerHit | null>(null);
  const [walkinName, setWalkinName] = React.useState("");
  const [walkinPhone, setWalkinPhone] = React.useState("");
  const [walkinEmail, setWalkinEmail] = React.useState("");
  const [items, setItems] = React.useState<Record<string, number>>({});
  const [amountPaid, setAmountPaid] = React.useState("");
  const [fullyPaid, setFullyPaid] = React.useState(true);
  const [status, setStatus] = React.useState<OrderStatus>("CONFIRMED");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMode("walkin");
    setCustomerQuery("");
    setCustomerHits([]);
    setCustomer(null);
    setWalkinName("");
    setWalkinPhone("");
    setWalkinEmail("");
    setItems({});
    setAmountPaid("");
    setFullyPaid(true);
    setStatus("CONFIRMED");
    setError(null);
  }, [open]);

  React.useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomerHits([]); return; }
    const timer = setTimeout(() => {
      adminFetch<CustomerHit[]>(`/api/admin/customers?q=${encodeURIComponent(customerQuery.trim())}`).then(setCustomerHits).catch(() => setCustomerHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const productById = React.useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selected = Object.entries(items);
  const total = selected.reduce((sum, [productId, quantity]) => sum + (productById.get(productId)?.price ?? 0) * quantity, 0);

  function toggleItem(productId: string, checked: boolean) {
    setItems((current) => {
      const next = { ...current };
      if (checked) next[productId] = next[productId] ?? 1;
      else delete next[productId];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (selected.length === 0) { setError("Add at least one product."); return; }
    if (mode === "existing" && !customer) { setError("Pick an existing customer, or switch to walk-in."); return; }
    if (mode === "walkin" && (!walkinName.trim() || !walkinPhone.trim())) { setError("Enter the customer's name and phone number."); return; }
    const paid = fullyPaid ? total : Math.round(Number(amountPaid || 0) * 100);
    if (!fullyPaid && (paid < 0 || paid > total)) { setError("Amount paid can't be more than the total."); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        items: selected.map(([productId, quantity]) => ({ productId, quantity })),
        amountPaid: paid,
        status,
      };
      if (mode === "existing") payload.customerId = customer!.id;
      else { payload.customerName = walkinName.trim(); payload.customerPhone = walkinPhone.trim(); payload.customerEmail = walkinEmail.trim(); }

      const created = await adminFetch<Order>("/api/admin/orders", { method: "POST", body: JSON.stringify(payload) });
      onCreated(created);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create that order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record a sale</DialogTitle>
          <DialogDescription>For an order taken in person, over the phone, or anywhere off the storefront.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Customer</Label>
            <div className="flex gap-2">
              <Button type="button" variant={mode === "walkin" ? "default" : "outline"} size="sm" onClick={() => setMode("walkin")}>
                Walk-in
              </Button>
              <Button type="button" variant={mode === "existing" ? "default" : "outline"} size="sm" onClick={() => setMode("existing")}>
                Existing customer
              </Button>
            </div>
          </div>

          {mode === "walkin" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="manual-order-name">Name <span className="text-destructive">*</span></Label>
                <Input id="manual-order-name" required minLength={2} value={walkinName} onChange={(event) => setWalkinName(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manual-order-phone">Phone <span className="text-destructive">*</span></Label>
                <Input id="manual-order-phone" required minLength={6} value={walkinPhone} onChange={(event) => setWalkinPhone(event.target.value)} placeholder="9876543210" />
              </div>
              {/* Spans both columns: an address is longer than a phone number,
                  and it is the one field here that does something after the
                  sale rather than just recording it. */}
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="manual-order-email">Email <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input
                  id="manual-order-email"
                  type="email"
                  value={walkinEmail}
                  onChange={(event) => setWalkinEmail(event.target.value)}
                  placeholder="buyer@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  {walkinEmail.trim()
                    ? "An order confirmation will be emailed to this address."
                    : "Add one to email this customer their order confirmation. Leave blank for a plain counter sale."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-1.5">
              {customer ? (
                <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Search by name, email or phone…" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} />
                  {customerHits.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-input">
                      {customerHits.map((hit) => (
                        <button
                          type="button"
                          key={hit.id}
                          className="flex w-full flex-col items-start border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
                          onClick={() => { setCustomer(hit); setCustomerHits([]); setCustomerQuery(""); }}
                        >
                          <span className="font-medium text-foreground">{hit.name}</span>
                          <span className="text-xs text-muted-foreground">{hit.email}{hit.phone ? ` · ${hit.phone}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Products ({selected.length})</Label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {products.map((product) => {
                const checked = product.id in items;
                return (
                  <div key={product.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleItem(product.id, event.target.checked)}
                      className="size-4 accent-[hsl(var(--primary))]"
                      aria-label={`Include ${product.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{product.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{product.sku} · {formatMoney(product.price)} · {product.stockQuantity} in stock</p>
                    </div>
                    {checked && (
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={items[product.id]}
                        onChange={(event) => setItems((current) => ({ ...current, [product.id]: Math.max(1, Number(event.target.value || 1)) }))}
                        className="h-8 w-16"
                        aria-label={`Quantity of ${product.name}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="manual-order-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus)}>
                <SelectTrigger id="manual-order-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.filter((candidate) => candidate !== "SHIPPED").map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>{candidate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Total</Label>
              <Input readOnly disabled value={formatMoney(total)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fullyPaid} onChange={(event) => setFullyPaid(event.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
              Paid in full
            </label>
            {!fullyPaid && (
              <div className="grid gap-1.5">
                <Label htmlFor="manual-order-paid">Amount paid now (₹)</Label>
                <Input id="manual-order-paid" type="number" min="0" step="0.01" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} placeholder="0.00" />
                <p className="text-xs text-muted-foreground">The rest is tracked as owed — record the balance later from the order row.</p>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
