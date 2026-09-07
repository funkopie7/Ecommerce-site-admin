import {
  Boxes,
  GalleryHorizontal,
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

export type NavItem = { title: string; url: Route; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

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
      { title: "Galleries", url: "/galleries", icon: GalleryHorizontal },
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
