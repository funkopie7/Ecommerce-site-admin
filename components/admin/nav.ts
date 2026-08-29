import {
  Boxes,
  Layers,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";

import type { Route } from "next";

// `experimental.typedRoutes` is on in next.config.ts, so Link's href is a
// generated union of real routes rather than a plain string.
export type NavItem = { title: string; url: Route; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * The admin's information architecture: four groups, each collapsible in the
 * sidebar. Every URL below is a real route under app/(dashboard)/.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", url: "/products", icon: Package },
      { title: "Categories", url: "/categories", icon: Layers },
      { title: "Collections", url: "/collections", icon: Boxes },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", url: "/orders", icon: Truck },
      { title: "Inventory", url: "/inventory", icon: ShoppingBag },
    ],
  },
  {
    label: "Configuration",
    items: [{ title: "Settings", url: "/settings", icon: Settings }],
  },
];
