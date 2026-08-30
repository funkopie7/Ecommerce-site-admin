"use client";

import * as React from "react";
import { ImageOff, Minus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { ProductDialog } from "@/components/admin/ProductDialog";
import { LOW_STOCK_THRESHOLD, type Category, type Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

export function ProductsView() {
  const products = useAdminResource<Product[]>("/api/admin/products");
  const categories = useAdminResource<Category[]>("/api/admin/categories");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [adjustingId, setAdjustingId] = React.useState<string | null>(null);

  const rows = products.data ?? [];

  // Same one-unit quick-adjust the Inventory page offers — kept here too so a
  // stock nudge doesn't require leaving the product list to make it.
  async function adjustStock(product: Product, delta: number) {
    setAdjustingId(product.id);
    try {
      await adminFetch("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, delta, reason: "Manual single-unit adjustment from admin" }),
      });
      await products.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not adjust that stock level.");
    } finally {
      setAdjustingId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setDialogOpen(true);
  }

  async function remove(product: Product) {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    try {
      await adminFetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      setNotice(`${product.name} was deleted.`);
      await products.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete that product.");
    }
  }

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- product images are arbitrary remote URLs; next/image would need a host allowlist we don't control.
              <img src={row.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{row.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "character",
      header: "Character",
      sortValue: (row) => row.character ?? "",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.character || "—"}</span>
      ),
    },
    {
      key: "franchise",
      header: "Franchise",
      sortValue: (row) => row.franchise ?? "",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.franchise || "—"}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (row) => row.category.name,
      cell: (row) => <span className="text-sm">{row.category.name}</span>,
    },
    {
      key: "price",
      header: "Price",
      sortValue: (row) => row.price,
      headClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => formatMoney(row.price),
    },
    {
      key: "stock",
      header: "Stock",
      sortValue: (row) => row.stockQuantity,
      headClassName: "w-32 text-right",
      className: "w-32",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <span
            className={
              row.stockQuantity < LOW_STOCK_THRESHOLD
                ? "w-6 text-right font-medium tabular-nums text-destructive"
                : "w-6 text-right tabular-nums"
            }
          >
            {row.stockQuantity}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={adjustingId === row.id || row.stockQuantity === 0}
            aria-label={`Remove one ${row.name}`}
            onClick={() => void adjustStock(row, -1)}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={adjustingId === row.id}
            aria-label={`Add one ${row.name}`}
            onClick={() => void adjustStock(row, 1)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => (row.visible ? "visible" : "hidden"),
      cell: (row) => (
        <Badge variant={row.visible ? "success" : "outline"}>
          {row.visible ? "Visible" : "Hidden"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-10",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openEdit(row)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => void remove(row)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description={
          products.error ? "Catalog unavailable" : `${rows.length} figures in the catalog`
        }
        action={
          <Button
            onClick={openCreate}
            disabled={(categories.data ?? []).length === 0}
            title={
              categories.error
                ? `Categories failed to load (${categories.error}), so a product can't be assigned one yet.`
                : (categories.data ?? []).length === 0
                  ? "Add a category first."
                  : undefined
            }
          >
            <Plus /> Add product
          </Button>
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {products.error && (
        <ErrorState message={`Could not load the product catalog (${products.error}).`} />
      )}
      {!products.error && categories.error && (
        <ErrorState
          message={`Categories could not be loaded (${categories.error}). "Add product" is disabled until they do.`}
        />
      )}

      {/* An empty table under a failed fetch reads as "no rows exist", so the
          table is withheld until the data actually loads. */}
      {!products.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={products.loading}
          searchIn={(row) =>
            `${row.name} ${row.sku} ${row.character ?? ""} ${row.franchise ?? ""} ${row.category.name}`
          }
          searchPlaceholder="Search name, SKU, character…"
          emptyMessage="No products yet. Add your first figure."
        />
      )}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories.data ?? []}
        onCategoryCreated={() => void categories.reload()}
        onSaved={async (message) => {
          setNotice(message);
          await products.reload();
        }}
      />
    </div>
  );
}
