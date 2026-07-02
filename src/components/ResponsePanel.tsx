import { useMemo, useState } from "react";
import type { RequestTab } from "../types";
import CodeEditor from "./CodeEditor";

type View = "body" | "headers";

function statusClass(status: number): string {
  if (status < 300) return "ok";
  if (status < 400) return "redirect";
  if (status < 500) return "client-err";
  return "server-err";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ResponsePanel({ tab }: { tab: RequestTab }) {
  const [view, setView] = useState<View>("body");
  const res = tab.response;

  // Pretty-print JSON bodies; detect language for syntax highlighting.
  const { text, language } = useMemo(() => {
    if (!res) return { text: "", language: "text" as const };
    if (res.bodyEncoding === "base64") {
      return {
        text: `[binary response — ${formatSize(res.sizeBytes)}, ${res.contentType ?? "unknown type"}]`,
        language: "text" as const,
      };
    }
    const ct = res.contentType ?? "";
    if (ct.includes("json")) {
      try {
        return {
          text: JSON.stringify(JSON.parse(res.body), null, 2),
          language: "json" as const,
        };
      } catch {
        return { text: res.body, language: "text" as const };
      }
    }
    if (ct.includes("xml")) return { text: res.body, language: "xml" as const };
    if (ct.includes("html")) return { text: res.body, language: "html" as const };
    return { text: res.body, language: "text" as const };
  }, [res]);

  if (tab.loading) {
    return (
      <div className="res-panel">
        <div className="res-placeholder">
          <span className="spinner" /> Sending request…
        </div>
      </div>
    );
  }

  if (tab.error) {
    return (
      <div className="res-panel">
        <div className="res-placeholder error">⚠ {tab.error}</div>
      </div>
    );
  }

  if (!res) {
    return (
      <div className="res-panel">
        <div className="res-placeholder muted">
          Send a request to see the response.
        </div>
      </div>
    );
  }

  return (
    <div className="res-panel">
      <div className="res-status">
        <span className={`pill ${statusClass(res.status)}`}>
          {res.status} {res.statusText}
        </span>
        <span className="meta">
          Time <b>{res.timeMs} ms</b>
        </span>
        <span className="meta">
          Size <b>{formatSize(res.sizeBytes)}</b>
        </span>
      </div>

      <div className="subtabs">
        <button
          className={view === "body" ? "active" : ""}
          onClick={() => setView("body")}
        >
          Body
        </button>
        <button
          className={view === "headers" ? "active" : ""}
          onClick={() => setView("headers")}
        >
          Headers<span className="badge">{res.headers.length}</span>
        </button>
      </div>

      <div className="subpanel">
        {view === "body" ? (
          <CodeEditor value={text} language={language} readOnly />
        ) : (
          <div className="res-headers">
            {res.headers.map(([k, v], i) => (
              <div className="hrow" key={`${k}-${i}`}>
                <span className="hkey">{k}</span>
                <span className="hval">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
