import { nanoid } from "nanoid";
import type { KeyValue } from "../types";

interface Props {
  rows: KeyValue[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  onChange: (rows: KeyValue[]) => void;
}

/**
 * Editable key/value/notes table (used for query params, headers and
 * variables). Keeps a trailing blank row so there is always somewhere to type a
 * new entry. The notes column is metadata only and never sent.
 */
export default function KeyValueEditor({
  rows,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  onChange,
}: Props) {
  function ensureTrailingBlank(next: KeyValue[]): KeyValue[] {
    const last = next[next.length - 1];
    // A row counts as "used" once it has a key or value (a note alone doesn't
    // spawn a new blank row).
    if (!last || last.key || last.value) {
      return [
        ...next,
        { id: nanoid(), key: "", value: "", enabled: true, note: "" },
      ];
    }
    return next;
  }

  function updateRow(id: string, patch: Partial<KeyValue>) {
    onChange(
      ensureTrailingBlank(
        rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      ),
    );
  }

  function removeRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length ? next : ensureTrailingBlank([]));
  }

  return (
    <div className="kv">
      {rows.map((row) => (
        <div className="kv-row" key={row.id}>
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
            aria-label="enable row"
          />
          <input
            className="kv-input"
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => updateRow(row.id, { key: e.target.value })}
          />
          <input
            className="kv-input"
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(e) => updateRow(row.id, { value: e.target.value })}
          />
          <input
            className="kv-input kv-note"
            placeholder="Notes"
            value={row.note ?? ""}
            onChange={(e) => updateRow(row.id, { note: e.target.value })}
          />
          <button
            className="kv-remove"
            onClick={() => removeRow(row.id)}
            aria-label="remove row"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
