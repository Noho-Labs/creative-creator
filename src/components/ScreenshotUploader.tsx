"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScreenshotUploader({
  creativeId,
  campaignId,
  hasScreenshot,
}: {
  creativeId: string;
  campaignId: string;
  hasScreenshot: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    hasScreenshot ? `/api/creatives/${creativeId}/screenshot` : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/creatives/${creativeId}/screenshot`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      router.push(`/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-sm text-zinc-500 hover:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-500">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview
          <img src={preview} alt="Screenshot preview" className="max-h-96 rounded-lg" />
        ) : (
          <span>Click to choose a screenshot (png, jpeg, or webp)</span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f) setPreview(URL.createObjectURL(f));
          }}
        />
      </label>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!file || submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? "Uploading…" : "Upload & generate"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/campaigns/${campaignId}`)}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Back to campaign
        </button>
      </div>
    </form>
  );
}
