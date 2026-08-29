import type { BadgeProps } from "@/components/ui/badge";
import type { OrderStatus } from "@/components/admin/types";

/**
 * Colour language for order state: green once it's delivered, brand orange
 * while it's moving, neutral before it's been confirmed, red when cancelled.
 */
export function orderStatusVariant(status: OrderStatus): BadgeProps["variant"] {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "destructive";
    case "PENDING":
      return "outline";
    default:
      return "warning";
  }
}
