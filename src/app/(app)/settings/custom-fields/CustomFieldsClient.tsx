"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomField } from "@/lib/types";
import { Plus, Trash2, GripVertical } from "lucide-react";

const TYPES = ["text", "number", "select", "checkbox", "date", "url"] as const;

function slug(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function CustomFieldsClient({ initial }: { initial: CustomField[] }) {
  const supabase = createClient();
  const [fields, setFields] = useState<CustomField[]>(initial);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const key = slug(label);
    if (!key) { setError("Give the field a name."); return; }
    if (fields.some((f) => f.key === key)) { setError("A field with that name already exists."); return; }
    setError(null);
    const row = {
      entity: "lead", label: label.trim(), key, field_type: type,
      options: type === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      position: fields.length,
    };
    const { data, error } = await supabase.from("custom_fields").insert(row).select().single();
    if (error) { setError(error.message); return; }
    setFields([...fields, data]);
    setLabel(""); setOptions(""); setType("text");
  }

  async function remove(id: string) {
    setFields((f) => f.filter((x) => x.id !== id));
    await supabase.from("custom_fields").delete().eq("id", id);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <h2 className="font-display text-lg font-semibold">Your fields</h2>
        <ul className="mt-4 space-y-2">
          {fields.length === 0 && <li className="text-sm text-muted">No custom fields yet.</li>}
          {fields.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
              <GripVertical className="h-4 w-4 text-muted" />
              <div className="flex-1">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted">
                  {f.field_type}{f.field_type === "select" && f.options.length ? ` · ${f.options.join(", ")}` : ""} · key: {f.key}
                </p>
              </div>
              <button className="btn-ghost px-2" onClick={() => remove(f.id)}>
                <Trash2 className="h-4 w-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card h-fit p-5">
        <h2 className="font-display text-lg font-semibold">Add a field</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Field name</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Budget range" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input capitalize" value={type} onChange={(e) => setType(e.target.value as any)}>
              {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </div>
          {type === "select" && (
            <div>
              <label className="label">Options (comma-separated)</label>
              <input className="input" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Low, Medium, High" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={add}><Plus className="h-4 w-4" /> Add field</button>
        </div>
      </div>
    </div>
  );
}
