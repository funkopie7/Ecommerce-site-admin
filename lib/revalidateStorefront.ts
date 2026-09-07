export function revalidateStorefront(): void {
  const url = process.env.STOREFRONT_REVALIDATE_URL || (process.env.NEXT_PUBLIC_STORE_URL ? `${process.env.NEXT_PUBLIC_STORE_URL}/api/revalidate` : "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  void fetch(url, {
    method: "POST",
    headers: { "x-revalidate-secret": secret },
    signal: AbortSignal.timeout(5000),
  }).catch((cause) => {
    console.warn("[revalidate] storefront ping failed:", cause instanceof Error ? cause.message : cause);
  });
}
