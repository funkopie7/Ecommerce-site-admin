import type { BadgeProps } from "@/components/ui/badge";
import type { OrderStatus } from "@/components/admin/types";

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
