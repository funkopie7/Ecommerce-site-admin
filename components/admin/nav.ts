import {
  Boxes,
  ImageIcon,
  Layers,
  LayoutDashboard,
  MessageCircle,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  Star,
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
      { title: "Images", url: "/media", icon: ImageIcon },
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
    // Its own group rather than more entries under Sales: talking to shoppers
    // is a different job from fulfilling orders. Messages is the screen an
    // admin keeps open while doing something else; Reviews is the one they
    // visit when something needs taking down.
    label: "Support",
    items: [
      { title: "Messages", url: "/messages", icon: MessageCircle },
      { title: "Reviews", url: "/reviews", icon: Star },
    ],
  },
  {
    label: "Configuration",
    items: [{ title: "Settings", url: "/settings", icon: Settings }],
  },
];
