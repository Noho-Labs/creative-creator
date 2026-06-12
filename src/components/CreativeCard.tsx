"use client";

import { Markdown } from "@/components/Markdown";
import type { CreativeDTO } from "@/lib/types";

const STATUS_STYLES: Record<CreativeDTO["status"], string> = {
  pending: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  generating: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 animate-pulse",
  complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

export function CreativeCard({
  creative,
  onRetry,
}: {
  creative: CreativeDTO;
  onRetry: (creativeId: string) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800">
        {creative.status === "complete" ? (
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
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700" />
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[creative.status]}`}
        >
          {creative.status}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm font-medium leading-snug">{creative.concept}</p>
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
