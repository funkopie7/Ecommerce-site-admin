"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Wallet, PiggyBank } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order, Product } from "@/components/admin/types";

const CHART_DAYS = 30;

const toRupees = (paise: number) => Math.round(paise / 100);

function dayKey(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function useProfitFigures(productList: Product[], orderList: Order[]) {
  return React.useMemo(() => {
    const costByProductId = new Map(productList.map((product) => [product.id, product.cost]));
    const counted = orderList.filter((order) => order.status !== "CANCELLED");

    let revenue = 0;
    let cost = 0;
    const byDay = new Map<string, { revenue: number; cost: number }>();
    const byProduct = new Map<string, { name: string; profit: number }>();

    for (const order of counted) {
      const key = dayKey(order.createdAt);
      const bucket = byDay.get(key) ?? { revenue: 0, cost: 0 };
      for (const item of order.items) {
        const itemRevenue = item.unitPrice * item.quantity;
        const unitCost = costByProductId.get(item.productId) ?? 0;
        const itemCost = unitCost * item.quantity;

        revenue += itemRevenue;
        cost += itemCost;
        bucket.revenue += itemRevenue;
        bucket.cost += itemCost;

        const productEntry = byProduct.get(item.productId) ?? { name: item.name, profit: 0 };
        productEntry.profit += itemRevenue - itemCost;
        byProduct.set(item.productId, productEntry);
      }
      byDay.set(key, bucket);
    }

    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const trend: { date: string; profit: number }[] = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = dayKey(date.toISOString());
      const bucket = byDay.get(key);
      trend.push({
        date: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        profit: toRupees((bucket?.revenue ?? 0) - (bucket?.cost ?? 0)),
      });
    }

    const topProducts = Array.from(byProduct.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6)
      .map((entry) => ({ name: entry.name, profit: toRupees(entry.profit) }));

    return { revenue, cost, profit, margin, trend, topProducts };
  }, [productList, orderList]);
}

function ProfitStat({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
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
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {value}
            </p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfitDashboard({
  loading,
  productList,
  orderList,
}: {
  loading: boolean;
  productList: Product[];
  orderList: Order[];
}) {
  const { revenue, cost, profit, margin, trend, topProducts } = useProfitFigures(
    productList,
    orderList,
  );

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Profit</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ProfitStat
          title="Revenue"
          value={formatMoney(revenue)}
          subtitle="From non-cancelled orders"
          icon={Wallet}
          loading={loading}
        />
        <ProfitStat
          title="Cost"
          value={formatMoney(cost)}
          subtitle="At each product's current cost"
          icon={PiggyBank}
          loading={loading}
        />
        <ProfitStat
          title="Profit"
          value={formatMoney(profit)}
          subtitle={loading ? "Margin —" : `${margin.toFixed(1)}% margin`}
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profit, last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(value: number) => `₹${value}`}
                    />
                    <Tooltip
                      formatter={(value) => [`₹${Number(value ?? 0).toLocaleString("en-IN")}`, "Profit"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#profitFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top products by profit</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No completed sales yet.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => `₹${value}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                      tickFormatter={(value: string) =>
                        value.length > 16 ? `${value.slice(0, 15)}…` : value
                      }
                    />
                    <Tooltip
                      formatter={(value) => [`₹${Number(value ?? 0).toLocaleString("en-IN")}`, "Profit"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
