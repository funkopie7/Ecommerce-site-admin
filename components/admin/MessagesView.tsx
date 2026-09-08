"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ImageOff, ImagePlus, RotateCcw, Send, X } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, PageHeader } from "@/components/admin/PageHeader";
import {
  type ConversationRow,
  type ConversationStatus,
  type ConversationThread,
} from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const LIST_POLL_MS = 6000;
const THREAD_POLL_MS = 6000;

const FILTERS = [
  { label: "Open", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
  { label: "All", value: "ALL" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

function ago(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const clockTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const preview = (message: { body: string; imageUrl: string | null }) =>
  message.body || (message.imageUrl ? "📷 Photo" : "");

export function MessagesView() {
  const [filter, setFilter] = React.useState<Filter>("OPEN");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const list = useAdminResource<ConversationRow[]>(
    `/api/admin/conversations${filter === "ALL" ? "" : `?status=${filter}`}`,
    LIST_POLL_MS,
  );
  const rows = list.data ?? [];
  const waiting = rows.reduce((count, row) => count + (row.unread > 0 ? 1 : 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Support"
        title="Messages"
        description={
          list.error
            ? "Conversations unavailable"
            : waiting === 0
              ? "Nothing waiting on a reply."
              : `${waiting} conversation${waiting === 1 ? "" : "s"} waiting on a reply`
        }
        action={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === option.value
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {list.error && <ErrorState message={`Could not load conversations (${list.error}).`} />}

      {!list.error && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {list.loading && rows.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading conversations…</p>
            )}
            {!list.loading && rows.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {filter === "CLOSED" ? "Nothing closed yet." : "No conversations yet."}
              </p>
            )}
            <ul className="max-h-[620px] divide-y divide-border overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(row.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.id); } }}
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-secondary/60",
                      selectedId === row.id && "bg-secondary",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {row.customer.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {ago(row.lastMessageAt)}
                      </span>
                    </div>
                    {row.product && (
                      <Link
                        href={`/products?id=${row.product.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                          {row.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- product images are arbitrary remote URLs; next/image would need a host allowlist we don't control.
                            <img src={row.product.imageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff className="size-3 text-muted-foreground" />
                          )}
                        </span>
                        <span className="truncate underline decoration-dotted underline-offset-2">re: {row.product.name}</span>
                      </Link>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {row.lastMessage
                          ? `${row.lastMessage.sender === "ADMIN" ? "You: " : ""}${preview(row.lastMessage)}`
                          : "No messages"}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {row.status === "CLOSED" && <Badge variant="outline">Closed</Badge>}
                        {row.unread > 0 && (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {row.unread}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <ThreadPane conversationId={selectedId} onChanged={() => void list.reload()} />
        </div>
      )}
    </div>
  );
}

function ThreadPane({
  conversationId,
  onChanged,
}: {
  conversationId: string | null;
  onChanged: () => void;
}) {
  const [thread, setThread] = React.useState<ConversationThread | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [attachment, setAttachment] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);
  const filePicker = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    if (!conversationId) return;
    try {
      setThread(await adminFetch<ConversationThread>(`/api/admin/conversations/${conversationId}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load that conversation.");
    }
  }, [conversationId]);

  React.useEffect(() => {
    setThread(null);
    setDraft("");
    setAttachment(null);
    void load();
    if (!conversationId) return;
    const timer = setInterval(() => void load(), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, load]);

  React.useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [thread?.messages.length]);

  async function attach(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/uploads/chat", { method: "POST", credentials: "include", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed");
      setAttachment(data.url as string);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not attach that image.");
    } finally {
      setUploading(false);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || !conversationId) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ ...(body ? { body } : {}), ...(attachment ? { imageUrl: attachment } : {}) }),
      });
      setDraft("");
      setAttachment(null);
      await load();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send that reply.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: ConversationStatus) {
    if (!conversationId) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update that conversation.");
    } finally {
      setBusy(false);
    }
  }

  if (!conversationId)
    return (
      <div className="grid min-h-[420px] place-items-center rounded-lg border border-border bg-card px-6 text-center">
        <p className="max-w-[36ch] text-sm text-muted-foreground">
          Pick a conversation to read it. Opening one marks it read for the whole team.
        </p>
      </div>
    );

  return (
    <div className="flex min-h-[420px] flex-col rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {thread?.customer.name ?? "Loading…"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{thread?.customer.email}</p>
          {thread?.product ? (
            <Link
              href={`/products?id=${thread.product.id}`}
              className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {thread.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- product images are arbitrary remote URLs; next/image would need a host allowlist we don't control.
                  <img src={thread.product.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOff className="size-3.5 text-muted-foreground" />
                )}
              </span>
              <span className="truncate underline decoration-dotted underline-offset-2">about {thread.product.name}</span>
            </Link>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {thread && <Badge variant={thread.status === "OPEN" ? "success" : "outline"}>{thread.status}</Badge>}
          {thread && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void setStatus(thread.status === "OPEN" ? "CLOSED" : "OPEN")}
            >
              {thread.status === "OPEN" ? (
                <>
                  <CheckCircle2 /> Close
                </>
              ) : (
                <>
                  <RotateCcw /> Reopen
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-5 pt-4">
          <ErrorState message={error} />
        </div>
      )}

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" style={{ maxHeight: 460 }}>
        {!thread && !error && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
        {thread?.messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex", message.sender === "ADMIN" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm",
                message.sender === "ADMIN"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-secondary text-secondary-foreground",
              )}
            >
              {message.imageUrl && (
                <a href={message.imageUrl} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.imageUrl}
                    alt="Attachment"
                    className={cn(
                      "max-h-60 w-auto max-w-full rounded-xl object-contain",
                      message.body && "mb-2",
                    )}
                  />
                </a>
              )}
              {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  message.sender === "ADMIN" ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {clockTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="border-t border-border px-5 py-3.5">
        {attachment && (
          <div className="mb-2.5 flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              Attached — sends with your next reply.
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAttachment(null)} aria-label="Remove attachment">
              <X />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2">
        <input
          ref={filePicker}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attach(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11"
          disabled={uploading || busy}
          onClick={() => filePicker.current?.click()}
          aria-label="Attach an image"
          title="Attach an image"
        >
          <ImagePlus />
        </Button>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          placeholder={thread?.status === "CLOSED" ? "This one is closed — a reply won't reopen it…" : "Write a reply…"}
          aria-label="Reply"
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <Button type="submit" size="sm" className="h-11" disabled={busy || uploading || (!draft.trim() && !attachment)}>
          <Send /> {uploading ? "Uploading…" : "Send"}
        </Button>
        </div>
      </form>
    </div>
  );
}
