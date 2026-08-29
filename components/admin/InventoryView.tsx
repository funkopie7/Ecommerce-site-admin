"use client";

import * as React from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
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
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { LOW_STOCK_THRESHOLD, type Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

export function InventoryView() {
  const products = useAdminResource<Product[]>("/api/admin/products");
  const [notice, setNotice] = React.useState("");
  const [adjusting, setAdjusting] = React.useState<Product | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const rows = products.data ?? [];

  async function adjust(product: Product, delta: number, reason: string) {
    setBusyId(product.id);
    try {
      await adminFetch("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, delta, reason }),
      });
      setNotice(
        `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} unit${Math.abs(delta) === 1 ? "" : "s"} of ${product.name}.`,
      );
      await products.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not adjust that stock level.");
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {row.sku} · {row.category.name}
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "On hand",
      sortValue: (row) => row.stockQuantity,
      headClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <span className="text-base font-semibold tabular-nums">{row.stockQuantity}</span>
      ),
    },
    {
      key: "level",
      header: "Level",
      sortValue: (row) => row.stockQuantity,
      cell: (row) =>
        row.stockQuantity === 0 ? (
          <Badge variant="destructive">Out of stock</Badge>
        ) : row.stockQuantity < LOW_STOCK_THRESHOLD ? (
          <Badge variant="warning">Low</Badge>
        ) : (
          <Badge variant="success">Healthy</Badge>
        ),
    },
    {
      key: "adjust",
      header: "Quick adjust",
      headClassName: "w-40 text-right",
      className: "w-40",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={busyId === row.id || row.stockQuantity === 0}
            aria-label={`Remove one ${row.name}`}
            onClick={() => void adjust(row, -1, "Manual single-unit adjustment from admin")}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={busyId === row.id}
            aria-label={`Add one ${row.name}`}
            onClick={() => void adjust(row, 1, "Manual single-unit adjustment from admin")}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busyId === row.id}
            aria-label={`Adjust ${row.name} with a reason`}
            onClick={() => setAdjusting(row)}
          >
            <SlidersHorizontal className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Sales"
        title="Inventory"
        description="Every adjustment writes an audit entry with its reason."
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {products.error && (
        <ErrorState message={`Could not load stock levels (${products.error}).`} />
      )}

      {/* An empty table under a failed fetch reads as "no rows exist", so the
          table is withheld until the data actually loads. */}
      {!products.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={products.loading}
          searchIn={(row) => `${row.name} ${row.sku} ${row.category.name}`}
          searchPlaceholder="Find a product"
          emptyMessage="No products to track yet."
        />
      )}

      <AdjustDialog
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onConfirm={async (product, delta, reason) => {
          setAdjusting(null);
          await adjust(product, delta, reason);
        }}
      />
    </div>
  );
}

function AdjustDialog({
  product,
  onClose,
  onConfirm,
}: {
  product: Product | null;
  onClose: () => void;
  onConfirm: (product: Product, delta: number, reason: string) => void;
}) {
  const [delta, setDelta] = React.useState("1");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (product) {
      setDelta("1");
      setReason("");
    }
  }, [product]);

  const parsedDelta = Number(delta);
  const valid = Number.isInteger(parsedDelta) && parsedDelta !== 0 && reason.trim().length >= 3;

  return (
    <Dialog open={Boolean(product)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name} — ${product.stockQuantity} on hand right now.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (product && valid) onConfirm(product, parsedDelta, reason.trim());
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-delta">Change</Label>
            <Input
              id="adjust-delta"
              type="number"
              step="1"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Positive to restock, negative to write off. Cannot take stock below zero.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Input
              id="adjust-reason"
              required
              minLength={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Damaged in transit"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              Apply adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
