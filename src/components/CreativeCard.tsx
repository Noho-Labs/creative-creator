"use client";

import Link from "next/link";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { CreativeDTO } from "@/lib/types";

const STATUS_STYLES: Record<CreativeDTO["status"], string> = {
  pending: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  generating:
    "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 animate-pulse",
  awaiting_screenshot:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  complete:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

const STATUS_LABELS: Partial<Record<CreativeDTO["status"], string>> = {
  awaiting_screenshot: "needs screenshot",
};

export function CreativeCard({
  creative,
  onRetry,
  selected,
  onSelect,
  onDecision,
  busy,
}: {
  creative: CreativeDTO;
  onRetry: (creativeId: string) => void;
  selected: boolean;
  onSelect: (creativeId: string) => void;
  onDecision: (
    creativeId: string,
    action: "approve" | "reject" | "revise",
    notes?: string,
  ) => Promise<boolean>;
  busy: boolean;
}) {
  const [revising, setRevising] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative aspect-[2/3] w-full bg-zinc-100 dark:bg-zinc-800">
        {creative.imagePath &&
        creative.status !== "failed" &&
        creative.status !== "awaiting_screenshot" ? (
          // eslint-disable-next-line @next/next/no-img-element -- local route-served PNG, no optimizer needed
          <img
            src={`/api/images/${creative.id}?v=${encodeURIComponent(creative.completedAt ?? "")}`}
            alt={creative.concept}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : creative.status === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="line-clamp-4 text-xs text-rose-600 dark:text-rose-400">
              {creative.error ?? "Generation failed"}
            </p>
            <button
              onClick={() => onRetry(creative.id)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
            >
              Retry
            </button>
          </div>
        ) : creative.status === "awaiting_screenshot" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="line-clamp-5 text-xs text-amber-700 dark:text-amber-300">
              {creative.screenshotRequest ??
                "This creative needs an app screenshot."}
            </p>
            <Link
              href={`/creatives/${creative.id}/screenshot`}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
            >
              Add screenshot
            </Link>
          </div>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700" />
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[creative.status]}`}
        >
          {STATUS_LABELS[creative.status] ?? creative.status}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {creative.reviewStatus.replaceAll("_", " ")} · v{creative.version}
          </span>
          {creative.status === "complete" &&
            creative.reviewStatus === "draft" && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onSelect(creative.id)}
                />
                Select
              </label>
            )}
        </div>
        <p className="text-sm font-medium leading-snug">{creative.concept}</p>
        <p className="text-xs text-zinc-500">
          {creative.reviewSummary.counts.approve} approve ·{" "}
          {creative.reviewSummary.counts.deny} deny ·{" "}
          {creative.reviewSummary.counts.changes} changes
        </p>
        {creative.reviewSummary.reviews.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-zinc-500">
              Reviewer notes
            </summary>
            <ul className="mt-2 space-y-3 text-xs">
              {creative.reviewSummary.reviews.map((review) => (
                <li key={review.email}>
                  <p className="font-medium">
                    {review.email} · {review.decision}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {review.note || "No note"}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
        {creative.reviewStatus === "in_review" &&
          creative.status === "complete" && (
            <>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  disabled={busy}
                  onClick={() => void onDecision(creative.id, "approve")}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => void onDecision(creative.id, "reject")}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-white disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setNotes(
                      creative.reviewSummary.reviews
                        .filter((review) => review.decision === "changes")
                        .map((review) => review.note)
                        .join("\n\n"),
                    );
                    setRevising(true);
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
                >
                  Revise
                </button>
              </div>
              {revising && (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (await onDecision(creative.id, "revise", notes))
                      setRevising(false);
                  }}
                >
                  <textarea
                    aria-label="Revision notes"
                    required
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="rounded-lg border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
                  />
                  <button
                    disabled={busy || !notes.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                  >
                    Revise with notes
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevising(false)}
                    className="text-xs text-zinc-500"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </>
          )}
        {creative.details && (
          <details>
            <summary className="cursor-pointer select-none text-xs text-zinc-500 dark:text-zinc-400">
              Details
            </summary>
            <div className="pt-2">
              <Markdown>{creative.details}</Markdown>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
