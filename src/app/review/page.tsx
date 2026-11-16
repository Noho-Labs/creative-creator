"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { CreativeDTO, ReviewDecision } from "@/lib/types";

type Queue = {
  creative: CreativeDTO | null;
  campaign: { name: string; brief: string } | null;
  remaining: number;
};

export default function ReviewPage() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [note, setNote] = useState("");
  const submitting = useRef(false);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/review", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok)
      throw new Error(json.error ?? "Could not load the review queue");
    setQueue(json);
    setError(null);
  }, []);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        if (alive) await load();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void refresh();
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    if (!queue || queue.creative) return;
    const timer = setInterval(() => {
      void load().catch((err) => setError(String(err)));
    }, 15000);
    return () => clearInterval(timer);
  }, [queue, load]);

  const submit = useCallback(
    async (decision: ReviewDecision) => {
      const creative = queue?.creative;
      if (!creative || submitting.current) return;
      if (decision === "changes" && !note.trim()) {
        setRequestingChanges(true);
        noteRef.current?.focus();
        return;
      }
      submitting.current = true;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/review/${creative.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            note: decision === "changes" ? note : "",
            version: creative.version,
          }),
        });
        const json = await response.json();
        if (!response.ok)
          throw new Error(json.error ?? "Could not save your review");
        await load();
        setRequestingChanges(false);
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    [queue, note, load],
  );

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest("input, textarea, button, a, summary") ||
          event.target.isContentEditable)
      )
        return;
      if (requestingChanges || busy) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void submit("deny");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void submit("approve");
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setRequestingChanges(true);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [submit, requestingChanges, busy]);

  useEffect(() => {
    if (requestingChanges) noteRef.current?.focus();
  }, [requestingChanges]);

  const creative = queue?.creative;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          {queue ? `${queue.remaining} left` : "Loading…"}
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}{" "}
          <button
            onClick={() => void load().catch((err) => setError(String(err)))}
            className="underline"
          >
            Retry loading
          </button>
        </div>
      )}
      {!queue && !error && (
        <p className="py-20 text-center text-zinc-500">
          Loading your next creative…
        </p>
      )}
      {queue && !creative && (
        <div className="rounded-xl border border-zinc-200 p-12 text-center dark:border-zinc-800">
          <h2 className="text-xl font-semibold">All caught up</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Thanks for reviewing. New creatives will appear here automatically.
          </p>
        </div>
      )}
      {creative && (
        <>
          <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div
              className="flex justify-center bg-zinc-100 dark:bg-zinc-950"
              style={{ touchAction: "none" }}
              onPointerDown={(event) => {
                if (!event.isPrimary || busy || requestingChanges) return;
                pointer.current = {
                  x: event.clientX,
                  y: event.clientY,
                  id: event.pointerId,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                pointer.current = null;
              }}
              onPointerUp={(event) => {
                const start = pointer.current;
                pointer.current = null;
                if (
                  !start ||
                  start.id !== event.pointerId ||
                  busy ||
                  requestingChanges
                )
                  return;
                const x = event.clientX - start.x;
                const y = event.clientY - start.y;
                if (Math.abs(x) > 65 && Math.abs(x) > Math.abs(y))
                  void submit(x > 0 ? "approve" : "deny");
                else if (y < -65 && Math.abs(y) > Math.abs(x))
                  setRequestingChanges(true);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local route-served creative */}
              <img
                draggable={false}
                src={`/api/images/${creative.id}?v=${encodeURIComponent(creative.completedAt ?? "")}`}
                alt={creative.concept}
                className="max-h-[60svh] w-full select-none object-contain"
              />
            </div>
            <div className="flex flex-col gap-3 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                {queue.campaign?.name} · Version {creative.version}
              </p>
              <h2 className="text-lg font-semibold">{creative.concept}</h2>
              {creative.details && (
                <details>
                  <summary className="cursor-pointer text-sm text-zinc-500">
                    Creative details
                  </summary>
                  <div className="pt-3">
                    <Markdown>{creative.details}</Markdown>
                  </div>
                </details>
              )}
              <details>
                <summary className="cursor-pointer text-sm text-zinc-500">
                  Campaign brief
                </summary>
                <div className="pt-3">
                  <Markdown>{queue.campaign?.brief ?? ""}</Markdown>
                </div>
              </details>
            </div>
          </article>
          {requestingChanges ? (
            <form
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              onSubmit={(event) => {
                event.preventDefault();
                void submit("changes");
              }}
            >
              <label htmlFor="review-note" className="text-sm font-medium">
                What should change?
              </label>
              <textarea
                ref={noteRef}
                id="review-note"
                required
                rows={3}
                disabled={busy}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    if (note.trim()) void submit("changes");
                  }
                }}
                placeholder="Describe your requested changes…"
                className="rounded-lg border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
              />
              <div className="flex gap-3">
                <button
                  disabled={busy || !note.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Submit changes"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRequestingChanges(false)}
                  className="text-sm text-zinc-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={busy}
                onClick={() => void submit("deny")}
                className="rounded-xl bg-rose-600 px-3 py-4 text-sm font-medium text-white disabled:opacity-50"
              >
                ← Deny
              </button>
              <button
                disabled={busy}
                onClick={() => setRequestingChanges(true)}
                className="rounded-xl bg-amber-500 px-3 py-4 text-sm font-medium text-zinc-950 disabled:opacity-50"
              >
                ↑ Request changes
              </button>
              <button
                disabled={busy}
                onClick={() => void submit("approve")}
                className="rounded-xl bg-emerald-600 px-3 py-4 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve →
              </button>
            </div>
          )}
          <p className="text-center text-xs text-zinc-500">
            Swipe or use arrow keys to review. Your decision is saved before
            moving on.
          </p>
        </>
      )}
    </div>
  );
}
