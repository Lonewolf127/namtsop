import { useState } from "react";
import type { BodyType, RequestTab } from "../types";
import { useStore } from "../store";
import KeyValueEditor from "./KeyValueEditor";
import CodeEditor from "./CodeEditor";

type SubTab = "params" | "headers" | "body";

const BODY_TYPES: { id: BodyType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "json", label: "JSON" },
  { id: "text", label: "Text" },
  { id: "xml", label: "XML" },
  { id: "form", label: "Form" },
];

export default function RequestPanel({ tab }: { tab: RequestTab }) {
  const update = useStore((s) => s.update);
  const [sub, setSub] = useState<SubTab>("params");

  const paramCount = tab.params.filter((p) => p.key.trim()).length;
  const headerCount = tab.headers.filter((h) => h.key.trim()).length;

  return (
    <div className="req-panel">
      <div className="subtabs">
        <button
          className={sub === "params" ? "active" : ""}
          onClick={() => setSub("params")}
        >
          Params{paramCount > 0 && <span className="badge">{paramCount}</span>}
        </button>
        <button
          className={sub === "headers" ? "active" : ""}
          onClick={() => setSub("headers")}
        >
          Headers
          {headerCount > 0 && <span className="badge">{headerCount}</span>}
        </button>
        <button
          className={sub === "body" ? "active" : ""}
          onClick={() => setSub("body")}
        >
          Body
          {tab.bodyType !== "none" && <span className="dot" />}
        </button>
      </div>

      <div className="subpanel">
        {sub === "params" && (
          <KeyValueEditor
            rows={tab.params}
            keyPlaceholder="Parameter"
            onChange={(params) => update(tab.id, { params })}
          />
        )}

        {sub === "headers" && (
          <KeyValueEditor
            rows={tab.headers}
            keyPlaceholder="Header"
            onChange={(headers) => update(tab.id, { headers })}
          />
        )}

        {sub === "body" && (
          <div className="body-editor">
            <div className="body-types">
              {BODY_TYPES.map((b) => (
                <label key={b.id} className="radio">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={tab.bodyType === b.id}
                    onChange={() => update(tab.id, { bodyType: b.id })}
                  />
                  {b.label}
                </label>
              ))}
            </div>
            {tab.bodyType === "none" ? (
              <div className="empty">This request has no body.</div>
            ) : (
              <div className="body-code">
                <CodeEditor
                  value={tab.body}
                  language={
                    tab.bodyType === "json"
                      ? "json"
                      : tab.bodyType === "xml"
                        ? "xml"
                        : "text"
                  }
                  placeholder="Request body…"
                  onChange={(body) => update(tab.id, { body })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
