import * as React from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm text-secondary-foreground"
    >
      <span className="min-w-0 truncate">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
