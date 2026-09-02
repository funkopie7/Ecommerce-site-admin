import {
  Boxes,
  Layers,
  LayoutDashboard,
  MessageCircle,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Route } from "next";

// `experimental.typedRoutes` is on in next.config.ts, so Link's href is a
// generated union of real routes rather than a plain string.
export type NavItem = { title: string; url: Route; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * The admin's information architecture: five groups, each collapsible in the
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
      { title: "Tags", url: "/tags", icon: Tags },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", url: "/orders", icon: Truck },
      { title: "Inventory", url: "/inventory", icon: ShoppingBag },
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Coupons", url: "/coupons", icon: Percent },
    ],
  },
  {
    // Its own group rather than a fifth entry under Sales: answering a shopper
    // is a different job from fulfilling an order, and it is the one screen an
    // admin keeps open while doing something else.
    label: "Support",
    items: [{ title: "Messages", url: "/messages", icon: MessageCircle }],
  },
  {
    label: "Configuration",
    items: [{ title: "Settings", url: "/settings", icon: Settings }],
  },
];
