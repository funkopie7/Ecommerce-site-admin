"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Coupon } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const isExpired = (coupon: Coupon) => Boolean(coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now());
const isExhausted = (coupon: Coupon) => coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;

const valueLabel = (coupon: Coupon) => (coupon.type === "PERCENT" ? `${coupon.value}% off` : `${formatMoney(coupon.value)} off`);

export function CouponsView() {
  const coupons = useAdminResource<Coupon[]>("/api/admin/coupons");
  const [editing, setEditing] = React.useState<Coupon | null>(null);
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  const rows = coupons.data ?? [];

  async function remove(coupon: Coupon) {
    if (!window.confirm(`Delete the "${coupon.code}" coupon? This cannot be undone.`)) return;
    try {
      await adminFetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      setNotice(`${coupon.code} was deleted.`);
      await coupons.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete that coupon.");
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await adminFetch(`/api/admin/coupons/${coupon.id}`, { method: "PATCH", body: JSON.stringify({ active: !coupon.active }) });
      await coupons.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update that coupon.");
    }
  }

  const columns: Column<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      sortValue: (row) => row.code,
      cell: (row) => <span className="font-mono text-sm font-medium text-foreground">{row.code}</span>,
    },
    {
      key: "value",
      header: "Discount",
      sortValue: (row) => row.value,
      cell: (row) => <span className="text-sm">{valueLabel(row)}</span>,
    },
    {
      key: "uses",
      header: "Uses",
      headClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => `${row.usedCount}${row.maxUses !== null ? ` / ${row.maxUses}` : ""}`,
    },
    {
      key: "expires",
      header: "Expires",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        if (!row.active) return <Badge variant="outline">Disabled</Badge>;
        if (isExpired(row)) return <Badge variant="outline">Expired</Badge>;
        if (isExhausted(row)) return <Badge variant="outline">Fully redeemed</Badge>;
        return <Badge variant="success">Active</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-10",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.code}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => { setEditing(row); setOpen(true); }}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void toggleActive(row)}>
              {row.active ? "Disable" : "Enable"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void remove(row)}>
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
        eyebrow="Marketing"
        title="Coupons"
        description={coupons.error ? "Coupons unavailable" : `${rows.length} discount code${rows.length === 1 ? "" : "s"}`}
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add coupon</Button>}
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {coupons.error && <ErrorState message={`Could not load coupons (${coupons.error}).`} />}

      {!coupons.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={coupons.loading}
          searchIn={(row) => row.code}
          searchPlaceholder="Search codes"
          emptyMessage="No coupons yet."
        />
      )}

      <CouponDialog
        open={open}
        onOpenChange={setOpen}
        coupon={editing}
        onSaved={async (message) => {
          setNotice(message);
          await coupons.reload();
        }}
      />
    </div>
  );
}

function CouponDialog({
  open,
  onOpenChange,
  coupon,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: Coupon | null;
  onSaved: (message: string) => void;
}) {
  const [code, setCode] = React.useState("");
  const [type, setType] = React.useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = React.useState("");
  const [maxUses, setMaxUses] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCode(coupon?.code ?? "");
    setType(coupon?.type ?? "PERCENT");
    // The route stores FIXED in paise; the field shows rupees, same
    // convention as ProductDialog's price field.
    setValue(coupon ? (coupon.type === "FIXED" ? (coupon.value / 100).toString() : coupon.value.toString()) : "");
    setMaxUses(coupon?.maxUses?.toString() ?? "");
    setExpiresAt(coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : "");
    setActive(coupon?.active ?? true);
    setError(null);
  }, [open, coupon]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      code: code.trim().toUpperCase(),
      type,
      value: Number(value || 0),
      active,
    };
    if (maxUses.trim()) payload.maxUses = Number(maxUses);
    else if (coupon) payload.maxUses = null;
    if (expiresAt) payload.expiresAt = new Date(`${expiresAt}T23:59:59`).toISOString();
    else if (coupon) payload.expiresAt = null;

    try {
      if (coupon) {
        await adminFetch(`/api/admin/coupons/${coupon.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        onSaved(`${payload.code} was updated.`);
      } else {
        await adminFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
        onSaved(`${payload.code} was created.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that coupon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{coupon ? "Edit coupon" : "Add coupon"}</DialogTitle>
          <DialogDescription>Codes shoppers can redeem at checkout for a percent- or flat-amount discount.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="coupon-code">Code <span className="text-destructive">*</span></Label>
            <Input
              id="coupon-code"
              required
              minLength={2}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="WELCOME10"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-type">Type</Label>
              <Select value={type} onValueChange={(next) => setType(next as "PERCENT" | "FIXED")}>
                <SelectTrigger id="coupon-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent off</SelectItem>
                  <SelectItem value="FIXED">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-value">{type === "PERCENT" ? "Percent" : "Amount (₹)"} <span className="text-destructive">*</span></Label>
              <Input
                id="coupon-value"
                required
                type="number"
                min="1"
                max={type === "PERCENT" ? "100" : undefined}
                step={type === "PERCENT" ? "1" : "0.01"}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-max-uses">Max uses</Label>
              <Input
                id="coupon-max-uses"
                type="number"
                min="1"
                step="1"
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-expires">Expires</Label>
              <Input id="coupon-expires" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4" />
            Active
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : coupon ? "Save changes" : "Create coupon"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
