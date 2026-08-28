"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export default function AdminLogin() {
  const router = useRouter();
  const [err, setErr] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr("");
    const key = String(new FormData(event.currentTarget).get("key") || "");
    const response = await fetch("/api/auth/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!response.ok) { setErr((await response.json().catch(() => ({}))).error || "Incorrect admin key"); return; }
    router.push("/");
    router.refresh();
  }
  return <main className="adminLoginShell"><form className="adminLoginCard" onSubmit={submit}><p className="adminKicker">SOAR / ADMIN</p><h1>Sign in to operations.</h1><label>Admin key<input required name="key" type="password" autoComplete="off" autoFocus/></label>{err && <p className="formError">{err}</p>}<button className="adminPrimary" type="submit">Enter workspace →</button></form></main>;
}
