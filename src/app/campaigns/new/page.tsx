"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brief }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create campaign");
      router.push(`/campaigns/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">New campaign</h1>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Spring linebacker push"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Brief</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Markdown supported — audience, tone, channels, anything the creatives should follow.
        </span>
        <textarea
          required
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={12}
          placeholder={"## Goal\n\n- Who is this for?\n- What should it feel like?"}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}
