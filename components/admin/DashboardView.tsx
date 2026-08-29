"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Package,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, PageHeader } from "@/components/admin/PageHeader";
import { LOW_STOCK_THRESHOLD, type Order, type Product } from "@/components/admin/types";
import { orderStatusVariant } from "@/components/admin/orderStatus";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {value}
            </p>
          )}
          {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Local time of day, resolved after mount so the server and client markup agree. */
function useGreeting() {
  const [greeting, setGreeting] = React.useState<string | null>(null);
  React.useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return greeting;
}

export function DashboardView() {
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const greeting = useGreeting();

  React.useEffect(() => {
    Promise.all([
      adminFetch<Product[]>("/api/admin/products"),
      adminFetch<Order[]>("/api/admin/orders"),
    ])
      .then(([productList, orderList]) => {
        setProducts(productList);
        setOrders(orderList);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Could not load dashboard data."),
      );
  }, []);

  const loading = !error && (!products || !orders);
  const productList = products ?? [];
  const orderList = orders ?? [];

  const lowStock = productList.filter((product) => product.stockQuantity < LOW_STOCK_THRESHOLD);
  const openOrders = orderList.filter(
    (order) => order.status !== "DELIVERED" && order.status !== "CANCELLED",
  );
  // The API exposes customers only through the orders they placed, so this is
  // deliberately labelled "with orders" rather than presented as a total.
  const customersWithOrders = new Set(orderList.map((order) => order.customer.email)).size;
  const unitsOnHand = productList.reduce((total, product) => total + product.stockQuantity, 0);

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={
          greeting ? `${greeting}. Your shelf is busy today.` : "Your shelf at a glance."
        }
      />

      {/* On failure the whole body is withheld: rendering the KPI grid against
          empty arrays would print a confident "0" for every metric, which reads
          as real data rather than as an outage. */}
      {error ? (
        <ErrorState message={`The dashboard could not read the store's data (${error}).`} />
      ) : (
        <DashboardBody
          loading={loading}
          productList={productList}
          orderList={orderList}
          lowStock={lowStock}
          openOrders={openOrders}
          customersWithOrders={customersWithOrders}
          unitsOnHand={unitsOnHand}
        />
      )}
    </div>
  );
}

function DashboardBody({
  loading,
  productList,
  orderList,
  lowStock,
  openOrders,
  customersWithOrders,
  unitsOnHand,
}: {
  loading: boolean;
  productList: Product[];
  orderList: Order[];
  lowStock: Product[];
  openOrders: Order[];
  customersWithOrders: number;
  unitsOnHand: number;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Products"
          value={productList.length}
          subtitle={`${productList.filter((product) => product.visible).length} visible on the storefront`}
          icon={Package}
          loading={loading}
        />
        <StatCard
          title="Orders"
          value={orderList.length}
          subtitle="Placed to date"
          icon={ShoppingCart}
          loading={loading}
        />
        <StatCard
          title="Awaiting fulfilment"
          value={openOrders.length}
          subtitle="Not yet delivered or cancelled"
          icon={Truck}
          loading={loading}
        />
        <StatCard
          title="Low stock"
          value={lowStock.length}
          subtitle={`Fewer than ${LOW_STOCK_THRESHOLD} units on hand`}
          icon={AlertTriangle}
          loading={loading}
        />
        <StatCard
          title="Units on hand"
          value={unitsOnHand}
          subtitle="Across the whole catalog"
          icon={Boxes}
          loading={loading}
        />
        <StatCard
          title="Customers with orders"
          value={customersWithOrders}
          subtitle="Distinct buyers"
          icon={Users}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              All orders <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <ListSkeleton />
            ) : orderList.length === 0 ? (
              <EmptyLine>No orders yet.</EmptyLine>
            ) : (
              <ul className="divide-y divide-border">
                {orderList.slice(0, 6).map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.customer.name}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {order.number}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm tabular-nums">{formatMoney(order.total)}</span>
                      <Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Low stock</CardTitle>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Inventory <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <ListSkeleton />
            ) : lowStock.length === 0 ? (
              <EmptyLine>Every product is above {LOW_STOCK_THRESHOLD} units.</EmptyLine>
            ) : (
              <ul className="divide-y divide-border">
                {lowStock.slice(0, 6).map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {product.sku} · {product.category.name}
                      </p>
                    </div>
                    <Badge variant={product.stockQuantity === 0 ? "destructive" : "warning"}>
                      {product.stockQuantity} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
