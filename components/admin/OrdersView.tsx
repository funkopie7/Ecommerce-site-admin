"use client";

import * as React from "react";

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
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { orderStatusVariant } from "@/components/admin/orderStatus";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function OrdersView() {
  const orders = useAdminResource<Order[]>("/api/admin/orders");
  const [notice, setNotice] = React.useState("");
  const [shipping, setShipping] = React.useState<Order | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const rows = orders.data ?? [];

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
    // for one instead of letting the request fail.
    if (status === "SHIPPED" && !order.trackingCode) {
      setShipping(order);
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
      sortValue: (row) => row.customer.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.customer.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.customer.email}</p>
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
        description={`${rows.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED").length} of ${rows.length} still to fulfil`}
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {orders.error && <ErrorState message={orders.error} />}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        loading={orders.loading}
        searchIn={(row) => `${row.number} ${row.customer.name} ${row.customer.email} ${row.status}`}
        searchPlaceholder="Search order number, customer…"
        emptyMessage="No orders yet."
      />

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
