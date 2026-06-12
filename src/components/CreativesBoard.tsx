"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreativeCard } from "@/components/CreativeCard";
import type { CreativeDTO } from "@/lib/types";

const POLL_MS = 2000;

export function CreativesBoard({
  campaignId,
  initialCreatives,
}: {
  campaignId: string;
  initialCreatives: CreativeDTO[];
}) {
  const [creativesList, setCreativesList] = useState<CreativeDTO[]>(initialCreatives);
  const [concept, setConcept] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conceptRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
    if (!res.ok) return;
    const json = await res.json();
    setCreativesList(json.creatives);
  }, [campaignId]);

  // Poll only while something is in flight; stops at all-terminal states and
  // restarts automatically when a new row appears (state change re-runs the effect).
  useEffect(() => {
    const active = creativesList.some(
      (c) => c.status === "pending" || c.status === "generating",
    );
    if (!active) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [creativesList, refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, details }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add creative");
      setCreativesList((prev) => [json.creative, ...prev]);
      setConcept("");
      setDetails("");
      conceptRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry(creativeId: string) {
    await fetch(`/api/creatives/${creativeId}/retry`, { method: "POST" });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-base font-semibold">
          {creativesList.length === 0 ? "Add your first creative" : "Add a creative"}
        </h2>
        <input
          ref={conceptRef}
          autoFocus={creativesList.length === 0}
          required
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Concept — one-line idea"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Details (optional, markdown) — setting, style, copy, mood…"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || concept.trim().length === 0}
          className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Save &amp; generate
        </button>
      </form>

      {creativesList.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {creativesList.map((c) => (
            <CreativeCard key={c.id} creative={c} onRetry={handleRetry} />
          ))}
        </div>
      )}
    </div>
  );
}
