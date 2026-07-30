"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, Loader2, X } from "lucide-react";

/**
 * Uploads an image to the public "branding" bucket and hands back its URL.
 *
 * Public read is required because these images get printed on invoices that
 * are emailed out — a signed URL would expire and leave a broken box in the
 * client's inbox.
 */
export function ImageUpload({
  value,
  onChange,
  folder,
  label,
  hint,
  boxClass = "h-32",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label: string;
  hint?: string;
  boxClass?: string;
}) {
  const supabase = createClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("That's not an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Keep it under 2 MB — it only prints a few centimetres wide.");
      return;
    }
    setBusy(true);
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${folder}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true, cacheControl: "31536000" });

    if (upErr) {
      setBusy(false);
      setError(upErr.message);
      return;
    }

    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    setBusy(false);
    onChange(data.publicUrl);
  }

  return (
    <div>
      <label className="label">{label}</label>

      <div className="mt-1 flex items-start gap-3">
        <div
          className={`grid ${boxClass} w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-black/[0.015]`}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <Upload className="h-5 w-5 text-muted" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline text-sm"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              <Upload className="h-3.5 w-3.5" /> {value ? "Replace" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                className="btn-ghost text-sm text-muted"
                onClick={() => onChange(null)}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
