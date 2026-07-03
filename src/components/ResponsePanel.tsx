import { useMemo, useState } from "react";
import type { RequestTab } from "../types";
import { formatByType } from "../lib/format";
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
  // Whether to show the beautified body (default on). Toggleable per response.
  const [pretty, setPretty] = useState(true);
  const res = tab.response;

  // Detect language, and prepare both raw and beautified body text.
  const { raw, formatted, language, canFormat, isBinary } = useMemo(() => {
    if (!res)
      return {
        raw: "",
        formatted: null as string | null,
        language: "text" as const,
        canFormat: false,
        isBinary: false,
      };
    if (res.bodyEncoding === "base64") {
      return {
        raw: `[binary response — ${formatSize(res.sizeBytes)}, ${res.contentType ?? "unknown type"}]`,
        formatted: null,
        language: "text" as const,
        canFormat: false,
        isBinary: true,
      };
    }
    const ct = res.contentType ?? "";
    const language = ct.includes("json")
      ? ("json" as const)
      : ct.includes("xml")
        ? ("xml" as const)
        : ct.includes("html")
          ? ("html" as const)
          : ("text" as const);
    const formatted = formatByType(res.body, language);
    return { raw: res.body, formatted, language, canFormat: !!formatted, isBinary: false };
  }, [res]);

  const text = pretty && formatted ? formatted : raw;

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
        {view === "body" && canFormat && !isBinary && (
          <div className="res-format-toggle">
            <button
              className={pretty ? "active" : ""}
              onClick={() => setPretty(true)}
              title="Beautified"
            >
              Pretty
            </button>
            <button
              className={!pretty ? "active" : ""}
              onClick={() => setPretty(false)}
              title="As received"
            >
              Raw
            </button>
          </div>
        )}
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
