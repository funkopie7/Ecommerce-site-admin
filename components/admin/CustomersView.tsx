"use client";

import * as React from "react";

import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ErrorState, PageHeader } from "@/components/admin/PageHeader";
import { orderStatusVariant } from "@/components/admin/orderStatus";
import type { Order } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  _count: { orders: number };
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function CustomersView() {
  const customers = useAdminResource<Customer[]>("/api/admin/customers");
  // Orders don't carry a customer id (only name/email), so the detail dialog
  // matches on email — unique on the Customer model, unlike name.
  const orders = useAdminResource<Order[]>("/api/admin/orders");
  const [viewing, setViewing] = React.useState<Customer | null>(null);

  const rows = customers.data ?? [];

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      sortValue: (row) => row.phone ?? "",
      cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.phone ?? "—"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      sortValue: (row) => row._count.orders,
      headClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row._count.orders,
    },
    {
      key: "since",
      header: "Member since",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      cell: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "view",
      header: "",
      headClassName: "w-24",
      className: "w-24",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>
          View
        </Button>
      ),
    },
  ];

  const viewingOrders = viewing ? (orders.data ?? []).filter((order) => order.customer?.email === viewing.email) : [];

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader eyebrow="Sales" title="Customers" description={`${rows.length} registered ${rows.length === 1 ? "account" : "accounts"}.`} />

      {customers.error && <ErrorState message={`Could not load customers (${customers.error}).`} />}

      {!customers.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={customers.loading}
          searchIn={(row) => `${row.name} ${row.email} ${row.phone ?? ""}`}
          searchPlaceholder="Find a customer"
          emptyMessage="No registered customers yet."
        />
      )}

      <Dialog open={Boolean(viewing)} onOpenChange={(next) => !next && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              {viewing?.email}
              {viewing?.phone ? ` · ${viewing.phone}` : ""} · Member since {viewing ? formatDate(viewing.createdAt) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {orders.loading ? (
              <p className="text-sm text-muted-foreground">Loading orders…</p>
            ) : viewingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders placed yet.</p>
            ) : (
              viewingOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-foreground">{order.number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
                    <span className="tabular-nums text-sm font-medium text-foreground">{formatMoney(order.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
