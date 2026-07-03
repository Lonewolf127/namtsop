import { useStore } from "../store";
import { formatByType } from "../lib/format";
import type { ScratchLang } from "../types";
import CodeEditor from "./CodeEditor";

const LANGS: { id: ScratchLang; label: string }[] = [
  { id: "json", label: "JSON" },
  { id: "xml", label: "XML" },
  { id: "text", label: "Text" },
];

/** Editor for a free-form scratch file (with JSON/XML formatting). */
export default function ScratchEditor({ scratchId }: { scratchId: string }) {
  const file = useStore((s) => s.scratch.find((f) => f.id === scratchId));
  const update = useStore((s) => s.updateScratchFile);

  if (!file) return <div className="empty">Scratch file not found.</div>;

  return (
    <div className="scratch">
      <div className="scratch-head">
        <input
          className="scratch-name"
          value={file.name}
          spellCheck={false}
          onChange={(e) => update(file.id, { name: e.target.value })}
        />
        <div className="scratch-langs">
          {LANGS.map((l) => (
            <label key={l.id} className="radio">
              <input
                type="radio"
                name={`lang-${file.id}`}
                checked={file.language === l.id}
                onChange={() => update(file.id, { language: l.id })}
              />
              {l.label}
            </label>
          ))}
        </div>
        <button
          className="format-btn"
          title="Beautify (JSON / XML)"
          disabled={!file.content.trim() || file.language === "text"}
          onClick={() => {
            const f = formatByType(file.content, file.language);
            if (f !== null) update(file.id, { content: f });
          }}
        >
          Format
        </button>
      </div>
      <div className="scratch-code">
        <CodeEditor
          value={file.content}
          language={file.language}
          placeholder="Scratch content — paste JSON/XML and hit Format…"
          onChange={(content) => update(file.id, { content })}
        />
      </div>
    </div>
  );
}
