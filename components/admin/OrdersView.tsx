"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
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
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ManualOrderDialog } from "@/components/admin/ManualOrderDialog";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { orderStatusVariant } from "@/components/admin/orderStatus";
import { ORDER_STATUSES, type Order, type OrderStatus, type Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const isPartiallyPaid = (order: Order) => order.amountPaid > 0 && order.amountPaid < order.total;

export function OrdersView() {
  const orders = useAdminResource<Order[]>("/api/admin/orders");
  const products = useAdminResource<Product[]>("/api/admin/products");
  const [notice, setNotice] = React.useState("");
  const [shipping, setShipping] = React.useState<Order | null>(null);
  const [recording, setRecording] = React.useState<Order | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [partialOnly, setPartialOnly] = React.useState(false);

  const rows = partialOnly ? (orders.data ?? []).filter(isPartiallyPaid) : orders.data ?? [];

  async function patch(order: Order, body: Record<string, unknown>, message: string) {
    setBusyId(order.id);
    try {
      await adminFetch("/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ orderId: order.id, ...body }),
      });
      setNotice(message);
      await orders.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update that order.");
    } finally {
      setBusyId(null);
    }
  }

  function changeStatus(order: Order, status: OrderStatus) {
    if (status === order.status) return;
    // The route rejects a SHIPPED transition without a tracking code, so ask
    // for one instead of letting the request fail. If the order already has a
    // code on file (e.g. re-shipping after SHIPPED -> PACKED -> SHIPPED),
    // resend that code instead of dropping it — the request body is what the
    // API validates, not the stored record.
    if (status === "SHIPPED") {
      if (!order.trackingCode) {
        setShipping(order);
        return;
      }
      void patch(
        order,
        { status, trackingCode: order.trackingCode, ...(order.carrier ? { carrier: order.carrier } : {}) },
        `Order ${order.number} moved to ${status.toLowerCase()}.`,
      );
      return;
    }
    void patch(order, { status }, `Order ${order.number} moved to ${status.toLowerCase()}.`);
  }

  const columns: Column<Order>[] = [
    {
      key: "number",
      header: "Order",
      sortValue: (row) => row.number,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium text-foreground">{row.number}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.items.length} {row.items.length === 1 ? "item" : "items"}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortValue: (row) => row.customer?.name ?? row.customerName ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.customer?.name ?? row.customerName ?? "—"}
            {!row.customer && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(walk-in)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.customer?.email ?? " "}</p>
          {(row.addressSnapshot?.phone ?? row.customerPhone) && (
            <p className="truncate font-mono text-xs text-muted-foreground">{row.addressSnapshot?.phone ?? row.customerPhone}</p>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "Placed",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      cell: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "total",
      header: "Total",
      sortValue: (row) => row.total,
      headClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => formatMoney(row.total),
    },
    {
      key: "payment",
      header: "Payment",
      sortValue: (row) => row.amountPaid,
      headClassName: "w-40",
      className: "w-40",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.paymentStatus === "PARTIALLY_PAID" ? (
            <div className="min-w-0">
              <Badge variant="warning">Partial</Badge>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatMoney(row.amountPaid)} of {formatMoney(row.total)}
              </p>
            </div>
          ) : row.paymentStatus === "PAID" || row.paymentStatus === "SIMULATED_PAID" ? (
            <Badge variant="success">Paid</Badge>
          ) : row.paymentStatus === "FAILED" ? (
            <Badge variant="destructive">Failed</Badge>
          ) : (
            <Badge variant="outline">Unpaid</Badge>
          )}
          {row.amountPaid < row.total && row.paymentStatus !== "SIMULATED_PAID" && row.paymentStatus !== "PAID" && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => setRecording(row)}>
              Record
            </Button>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => ORDER_STATUSES.indexOf(row.status),
      cell: (row) => <Badge variant={orderStatusVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: "change",
      header: "Change status",
      headClassName: "w-44",
      className: "w-44",
      cell: (row) => (
        <Select
          value={row.status}
          onValueChange={(value) => changeStatus(row, value as OrderStatus)}
          disabled={busyId === row.id}
        >
          <SelectTrigger className="h-8" aria-label={`Status for order ${row.number}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description={
          orders.error
            ? "Orders unavailable"
            : `${(orders.data ?? []).filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED").length} of ${(orders.data ?? []).length} still to fulfil`
        }
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Record a sale
          </Button>
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {orders.error && <ErrorState message={`Could not load orders (${orders.error}).`} />}

      {/* An empty table under a failed fetch reads as "no rows exist", so the
          table is withheld until the data actually loads. */}
      {!orders.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={orders.loading}
          searchIn={(row) =>
            `${row.number} ${row.customer?.name ?? row.customerName ?? ""} ${row.customer?.email ?? ""} ${row.addressSnapshot?.phone ?? row.customerPhone ?? ""} ${row.status} ${row.items.map((item) => item.name).join(" ")}`
          }
          searchPlaceholder="Search order, customer, phone, product…"
          emptyMessage="No orders yet."
          toolbar={
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={partialOnly}
                onChange={(event) => setPartialOnly(event.target.checked)}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              Partially paid only
            </label>
          }
        />
      )}

      <ShipDialog
        order={shipping}
        onClose={() => setShipping(null)}
        onConfirm={async (order, carrier, trackingCode) => {
          setShipping(null);
          await patch(
            order,
            { status: "SHIPPED", trackingCode, ...(carrier ? { carrier } : {}) },
            `Order ${order.number} is on its way.`,
          );
        }}
      />

      <RecordPaymentDialog
        order={recording}
        onClose={() => setRecording(null)}
        onRecorded={async (message) => {
          setRecording(null);
          setNotice(message);
          await orders.reload();
        }}
      />

      <ManualOrderDialog
        open={creating}
        onOpenChange={setCreating}
        products={products.data ?? []}
        onCreated={async (order) => {
          setNotice(`Order ${order.number} created.`);
          await orders.reload();
        }}
      />
    </div>
  );
}

function ShipDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  onClose: () => void;
  onConfirm: (order: Order, carrier: string, trackingCode: string) => void;
}) {
  const [carrier, setCarrier] = React.useState("");
  const [trackingCode, setTrackingCode] = React.useState("");

  React.useEffect(() => {
    if (order) {
      setCarrier(order.carrier ?? "");
      setTrackingCode(order.trackingCode ?? "");
    }
  }, [order]);

  return (
    <Dialog open={Boolean(order)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ship order {order?.number}</DialogTitle>
          <DialogDescription>
            A tracking code is required before an order can be marked shipped.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (order) onConfirm(order, carrier.trim(), trackingCode.trim());
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ship-carrier">Carrier</Label>
            <Input
              id="ship-carrier"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ship-tracking">Tracking code</Label>
            <Input
              id="ship-tracking"
              required
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Mark shipped</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  order,
  onClose,
  onRecorded,
}: {
  order: Order | null;
  onClose: () => void;
  onRecorded: (message: string) => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const remaining = order ? order.total - order.amountPaid : 0;

  React.useEffect(() => {
    if (order) {
      setAmount((remaining / 100).toString());
      setMethod("");
      setNote("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    const paise = Math.round(Number(amount || 0) * 100);
    if (paise <= 0) { setError("Enter an amount greater than zero."); return; }
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/orders/${order.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: paise, method: method.trim() || undefined, note: note.trim() || undefined }),
      });
      onRecorded(`Recorded ${formatMoney(paise)} against order ${order.number}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record that payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {order ? `${formatMoney(order.amountPaid)} of ${formatMoney(order.total)} paid so far on ${order.number}.` : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="payment-amount">Amount (₹)</Label>
            <Input id="payment-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <p className="text-xs text-muted-foreground">Up to {formatMoney(remaining)} still owed.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payment-method">Method</Label>
            <Input id="payment-method" value={method} onChange={(event) => setMethod(event.target.value)} placeholder="Cash, UPI, card…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payment-note">Note</Label>
            <Input id="payment-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
