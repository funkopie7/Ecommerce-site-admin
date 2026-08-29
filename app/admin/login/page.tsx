"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr("");
    setBusy(true);
    const key = String(new FormData(event.currentTarget).get("key") || "");
    const response = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) {
      setErr((await response.json().catch(() => ({}))).error || "Incorrect admin key");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Funkopie / Admin
              </p>
              <h1 className="text-lg font-bold tracking-tight">Sign in to operations</h1>
            </div>
          </div>

          {/* method="post" only matters in the sliver before hydration: without
              it a stray Enter submits natively as a GET and writes the admin key
              into the URL and browser history. Once hydrated, submit() runs and
              preventDefault stops the navigation either way. */}
          <form onSubmit={submit} method="post" className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="admin-key">Admin key</Label>
              <Input
                id="admin-key"
                required
                name="key"
                type="password"
                autoComplete="off"
                autoFocus
              />
            </div>
            {err && (
              <p role="alert" className="text-sm text-destructive">
                {err}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Checking…" : "Enter workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
