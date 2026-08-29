"use client";

import * as React from "react";
import { CheckCircle2, RotateCcw, Send } from "lucide-react";

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

/* The support inbox. Two panes rather than the DataTable every other section
   uses: a conversation is read and answered in place, so a row that opens a
   thread beside it beats a row that navigates away and back.
   Freshness is polling, not a socket — this repo has no realtime layer, and a
   support desk that sees a new message within a few seconds is not worth one.
   The list refetches every 6s; the open thread does too, on its own timer. */
const LIST_POLL_MS = 6000;
const THREAD_POLL_MS = 6000;

const FILTERS = [
  { label: "Open", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
  { label: "All", value: "ALL" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/* Relative time, because "2m ago" is what tells an admin whether someone is
   still sitting there waiting. Falls back to a date once that stops meaning
   anything useful. */
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

export function MessagesView() {
  const [filter, setFilter] = React.useState<Filter>("OPEN");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const list = useAdminResource<ConversationRow[]>(
    `/api/admin/conversations${filter === "ALL" ? "" : `?status=${filter}`}`,
    LIST_POLL_MS,
  );
  const rows = list.data ?? [];
  const waiting = rows.reduce((count, row) => count + (row.unread > 0 ? 1 : 0), 0);

  /* A thread selected under one filter can vanish from the list when the filter
     changes (or when it is closed). Clearing the selection then would throw the
     admin out of a conversation they are mid-reply on, so the thread pane keeps
     rendering the id it was given and the list simply stops highlighting it. */
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
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-secondary/60",
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
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        re: {row.product.name}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {row.lastMessage
                          ? `${row.lastMessage.sender === "ADMIN" ? "You: " : ""}${row.lastMessage.body}`
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
                  </button>
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
  const [busy, setBusy] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    if (!conversationId) return;
    try {
      setThread(await adminFetch<ConversationThread>(`/api/admin/conversations/${conversationId}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load that conversation.");
    }
  }, [conversationId]);

  /* Selecting a different conversation must not leave the previous thread on
     screen while the new one loads — that reads as "the reply went to the wrong
     person". Blank it first, then fetch. */
  React.useEffect(() => {
    setThread(null);
    setDraft("");
    void load();
    if (!conversationId) return;
    const timer = setInterval(() => void load(), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, load]);

  /* Every load — including a poll that brought in a new customer message —
     pins the view to the newest message, the way a chat window behaves. */
  React.useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [thread?.messages.length]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setDraft("");
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
          <p className="truncate text-xs text-muted-foreground">
            {thread?.customer.email}
            {thread?.product ? ` · about ${thread.product.name}` : ""}
          </p>
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
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
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

      <form onSubmit={send} className="flex items-end gap-2 border-t border-border px-5 py-3.5">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, shift+Enter breaks the line — what every chat does.
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
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
          <Send /> Send
        </Button>
      </form>
    </div>
  );
}
