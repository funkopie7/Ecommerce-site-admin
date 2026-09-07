"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { useAdminResource } from "@/components/admin/useAdminResource";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  status: "PUBLISHED" | "HIDDEN";
  createdAt: string;
  customer: { name: string; email: string };
  product: { name: string; slug: string };
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={star <= rating ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

export function ReviewsView() {
  const reviews = useAdminResource<Review[]>("/api/admin/reviews");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const rows = reviews.data ?? [];
  const hidden = rows.filter((row) => row.status === "HIDDEN").length;

  async function act(review: Review, action: "hide" | "publish" | "delete") {
    if (action === "delete" && !confirm(`Delete ${review.customer.name}'s review of ${review.product.name}? This can't be undone.`)) return;
    setBusy(review.id);
    try {
      await adminFetch(
        `/api/admin/reviews/${review.id}`,
        action === "delete"
          ? { method: "DELETE" }
          : { method: "PATCH", body: JSON.stringify({ status: action === "hide" ? "HIDDEN" : "PUBLISHED" }) },
      );
      setNotice(action === "delete" ? "Review deleted." : action === "hide" ? "Review hidden from the storefront." : "Review published.");
      await reviews.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update that review.");
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<Review>[] = [
    {
      key: "rating",
      header: "Rating",
      headClassName: "w-28",
      className: "w-28",
      sortValue: (row) => row.rating,
      cell: (row) => <Stars rating={row.rating} />,
    },
    {
      key: "review",
      header: "Review",
      sortValue: (row) => row.title ?? row.body,
      cell: (row) => (
        <div className="min-w-0 max-w-md">
          {row.title && <p className="truncate font-medium text-foreground">{row.title}</p>}
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.body}</p>
        </div>
      ),
    },
    {
      key: "product",
      header: "Figure",
      sortValue: (row) => row.product.name,
      cell: (row) => <span className="text-sm text-foreground">{row.product.name}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      sortValue: (row) => row.customer.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {row.customer.name}
            {row.verifiedPurchase && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-600">verified</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.customer.email}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Posted",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      cell: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <Badge variant={row.status === "HIDDEN" ? "secondary" : "default"}>{row.status === "HIDDEN" ? "Hidden" : "Live"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-40",
      className: "w-40",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={busy === row.id} onClick={() => act(row, row.status === "HIDDEN" ? "publish" : "hide")}>
            {row.status === "HIDDEN" ? "Publish" : "Hide"}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === row.id} onClick={() => act(row, "delete")}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Support"
        title="Reviews"
        description={`${rows.length} ${rows.length === 1 ? "review" : "reviews"}${hidden > 0 ? ` · ${hidden} hidden` : ""}. Reviews go live as soon as a customer posts them — hide anything that shouldn't be there.`}
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
      {reviews.error && <ErrorState message={`Could not load reviews (${reviews.error}).`} />}

      {!reviews.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={reviews.loading}
          searchIn={(row) => `${row.customer.name} ${row.customer.email} ${row.product.name} ${row.title ?? ""} ${row.body}`}
          searchPlaceholder="Find a review"
          emptyMessage="No reviews yet."
        />
      )}
    </div>
  );
}
