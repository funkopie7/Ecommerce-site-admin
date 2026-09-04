import { prisma } from "@/lib/prisma";

/* Transactional email, sent through Resend's REST API rather than its SDK —
   it's one POST, and a dependency that wraps one POST is a dependency that
   has to be kept current for nothing.

   FROM has to be a domain the shop controls. The obvious choice, the owner's
   Gmail address, cannot work: gmail.com publishes SPF authorising only
   Google's servers and a DMARC record, so mail sent from anywhere else
   claiming to be @gmail.com fails authentication and lands in spam — and no
   provider will let you verify a domain you can't add DNS records to.
   REPLY-TO is where that Gmail address belongs instead, so a customer
   hitting reply still reaches an inbox that's actually read.

   Every send is best-effort: a shop that can't email must still take orders.
   Callers get `false` and a logged reason, never an exception. */

const FROM = process.env.ORDER_EMAIL_FROM || "Funkopie <orders@funkopie.in>";
const REPLY_TO = process.env.ORDER_EMAIL_REPLY_TO || "funkopie7@gmail.com";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://www.funkopie.in";

const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* Anything interpolated into the HTML below is customer-controlled — their
   name, an address they typed, a product title. Escaped here rather than
   trusted, because an unescaped apostrophe or angle bracket in an address
   line is enough to break the markup, quite apart from the injection. */
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Address = { recipient?: string; line1?: string; line2?: string | null; city?: string; state?: string; postalCode?: string; country?: string; phone?: string };

async function send(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Not configured yet. Say so once, plainly, rather than throwing — the
    // order itself is complete and valid without the email.
    console.warn("[email] RESEND_API_KEY not set — skipping", subject);
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text }),
    });
    if (!response.ok) {
      console.error(`[email] ${subject} -> ${to} failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (cause) {
    console.error(`[email] ${subject} -> ${to} threw:`, cause instanceof Error ? cause.message : cause);
    return false;
  }
}

/* Claims the order, builds the email, sends it. The claim is a conditional
   update: three different code paths can complete the same order (the COD
   route, the Razorpay verify route, and the payment.captured webhook racing
   it), and whichever gets the row first is the only one that sends. A claim
   whose send then fails is released, so the next attempt can retry rather
   than the order being permanently marked as emailed. */
export async function sendOrderConfirmation(orderId: string): Promise<boolean> {
  let claimed = false;
  try {
    const claim = await prisma.order.updateMany({
      where: { id: orderId, confirmationSentAt: null },
      data: { confirmationSentAt: new Date() },
    });
    if (claim.count === 0) return false; // already sent, or being sent right now
    claimed = true;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { product: true, collection: true } } },
    });
    const to = order?.customer?.email;
    if (!order || !to) {
      console.warn("[email] order confirmation skipped — no customer email for", orderId);
      return false;
    }

    const address = (order.addressSnapshot ?? null) as Address | null;
    const html = orderConfirmationHtml(order, address);
    const text = orderConfirmationText(order, address);
    const sent = await send(to, `Order ${order.number} confirmed`, html, text);
    if (!sent) throw new Error("send failed");
    return true;
  } catch (cause) {
    /* Release the claim so this can be retried instead of the customer
       silently never hearing from us — but only if we took it. If the claim
       write itself is what failed, there's nothing to give back. */
    if (claimed) {
      await prisma.order.updateMany({ where: { id: orderId }, data: { confirmationSentAt: null } }).catch(() => {});
    }
    console.error("[email] order confirmation failed for", orderId, cause instanceof Error ? cause.message : cause);
    return false;
  }
}

type OrderForEmail = {
  number: string;
  subtotal: number;
  shipping: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  items: { quantity: number; unitPrice: number; product: { name: string } | null; collection: { name: string } | null }[];
};

const lineName = (item: OrderForEmail["items"][number]) => item.collection?.name ?? item.product?.name ?? "Item";

function addressBlock(address: Address | null): string[] {
  if (!address) return [];
  return [address.recipient, address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(" "), address.country, address.phone]
    .filter((line): line is string => Boolean(line && line.trim()));
}

function orderConfirmationHtml(order: OrderForEmail, address: Address | null): string {
  const rows = order.items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #E8D9C3;color:#3A2E22;font-size:14px">
        ${escape(lineName(item))} <span style="color:#8A7A65">× ${item.quantity}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #E8D9C3;text-align:right;color:#3A2E22;font-size:14px;white-space:nowrap">
        ${money(item.unitPrice * item.quantity)}
      </td>
    </tr>`).join("");

  const totalRow = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:6px 0;color:${strong ? "#3A2E22" : "#8A7A65"};font-size:${strong ? "16px" : "14px"};font-weight:${strong ? 700 : 400}">${label}</td>
      <td style="padding:6px 0;text-align:right;color:${strong ? "#3A2E22" : "#8A7A65"};font-size:${strong ? "16px" : "14px"};font-weight:${strong ? 700 : 400};white-space:nowrap">${value}</td>
    </tr>`;

  const shipTo = addressBlock(address);

  /* Tables and inline styles on purpose: email clients are still a decade
     behind on layout, and Outlook in particular ignores most of a stylesheet. */
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FBF3E7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF3E7;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF9;border-radius:20px;padding:36px 32px">
        <tr><td>
          <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#8A7A65">Funkopie</p>
          <h1 style="margin:10px 0 6px;font-size:26px;color:#3A2E22">Order ${escape(order.number)} confirmed</h1>
          <p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#8A7A65">
            Thank you — we're getting your order ready. We'll email you again the moment it ships.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
            ${totalRow("Subtotal", money(order.subtotal))}
            ${order.discountAmount > 0 ? totalRow(`Discount${order.discountCode ? ` (${escape(order.discountCode)})` : ""}`, `− ${money(order.discountAmount)}`) : ""}
            ${totalRow("Shipping", order.shipping === 0 ? "Free" : money(order.shipping))}
            ${totalRow("Total", money(order.total), true)}
          </table>

          ${shipTo.length ? `
          <h2 style="margin:30px 0 8px;font-size:14px;color:#3A2E22">Shipping to</h2>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#8A7A65">${shipTo.map(escape).join("<br>")}</p>` : ""}

          <p style="margin:30px 0 0">
            <a href="${STORE_URL}/account" style="display:inline-block;background:#E8622A;color:#FFFDF9;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:600">View your order</a>
          </p>

          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#8A7A65">
            Questions about this order? Just reply to this email.
          </p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#8A7A65">Funkopie · Authentic collectibles, delivered across India</p>
    </td></tr>
  </table>
</body></html>`;
}

/* A plain-text part isn't decoration: without one, spam filters score the
   message worse and text-only clients get nothing readable. */
function orderConfirmationText(order: OrderForEmail, address: Address | null): string {
  const lines = [
    `Order ${order.number} confirmed`,
    "",
    "Thank you — we're getting your order ready. We'll email you again the moment it ships.",
    "",
    ...order.items.map((item) => `${lineName(item)} x ${item.quantity} — ${money(item.unitPrice * item.quantity)}`),
    "",
    `Subtotal: ${money(order.subtotal)}`,
  ];
  if (order.discountAmount > 0) lines.push(`Discount${order.discountCode ? ` (${order.discountCode})` : ""}: -${money(order.discountAmount)}`);
  lines.push(`Shipping: ${order.shipping === 0 ? "Free" : money(order.shipping)}`, `Total: ${money(order.total)}`);
  const shipTo = addressBlock(address);
  if (shipTo.length) lines.push("", "Shipping to:", ...shipTo);
  lines.push("", `View your order: ${STORE_URL}/account`, "", "Questions? Just reply to this email.");
  return lines.join("\n");
}
