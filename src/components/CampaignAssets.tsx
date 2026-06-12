"use client";

import { useRef, useState } from "react";

function AssetSlot({
  campaignId,
  kind,
  label,
  initialHas,
}: {
  campaignId: string;
  kind: "icon" | "logo";
  label: string;
  initialHas: boolean;
}) {
  const [has, setHas] = useState(initialHas);
  const [version, setVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setHas(true);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={has ? `Replace ${label}` : `Upload ${label}`}
        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-white text-lg text-zinc-400 hover:border-indigo-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-indigo-500"
      >
        {has ? (
          // eslint-disable-next-line @next/next/no-img-element -- local route-served upload
          <img
            src={`/api/campaigns/${campaignId}/assets/${kind}?v=${version}`}
            alt={label}
            className="h-full w-full object-contain"
          />
        ) : (
          <span>{uploading ? "…" : "+"}</span>
        )}
      </button>
      <div className="flex flex-col">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {error ?? (has ? "click to replace" : "click to upload")}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function CampaignAssets({
  campaignId,
  hasIcon,
  hasLogo,
}: {
  campaignId: string;
  hasIcon: boolean;
  hasLogo: boolean;
}) {
  return (
    <div className="flex items-center gap-6 rounded-xl border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <AssetSlot campaignId={campaignId} kind="icon" label="App icon" initialHas={hasIcon} />
      <AssetSlot campaignId={campaignId} kind="logo" label="Logo" initialHas={hasLogo} />
      <p className="ml-auto hidden max-w-64 text-right text-xs text-zinc-500 sm:block dark:text-zinc-400">
        Attached automatically when a creative calls for app UI, icon, or logo.
      </p>
    </div>
  );
}
