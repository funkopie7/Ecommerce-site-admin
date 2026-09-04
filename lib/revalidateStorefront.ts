/* Tells the storefront to drop its cached catalogue.

   The storefront prerenders its catalogue pages and revalidates them on an
   hour. That is what makes them fast, but it also meant an admin who changed
   a product photo kept seeing the old one and reasonably concluded the save
   hadn't worked. Every catalogue write now pings the storefront, so an edit
   shows up in seconds and the hour is only a backstop.

   Deliberately fire-and-forget and completely silent on failure: the write
   has already been committed by the time this runs, and a storefront that is
   down, slow, or not yet configured must never turn a successful save into a
   failed request. The worst case is the old behaviour — the change appears
   within the hour. */
export function revalidateStorefront(): void {
  const url = process.env.STOREFRONT_REVALIDATE_URL || (process.env.NEXT_PUBLIC_STORE_URL ? `${process.env.NEXT_PUBLIC_STORE_URL}/api/revalidate` : "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  void fetch(url, {
    method: "POST",
    headers: { "x-revalidate-secret": secret },
    // The admin request should not wait on the storefront's regeneration.
    signal: AbortSignal.timeout(5000),
  }).catch((cause) => {
    console.warn("[revalidate] storefront ping failed:", cause instanceof Error ? cause.message : cause);
  });
}
