import { useEffect, useState } from "react";
import type { HistoryEntry, RequestTab } from "../types";
import { useStore } from "../store";
import CodeEditor from "./CodeEditor";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusClass(status: number): string {
  if (status < 300) return "ok";
  if (status < 400) return "redirect";
  if (status < 500) return "client-err";
  return "server-err";
}

function EntryDetail({ tab, entry }: { tab: RequestTab; entry: HistoryEntry }) {
  const update = useStore((s) => s.update);
  const [view, setView] = useState<"payload" | "response">("response");
  const req = entry.request;
  const res = entry.response;

  const bodyLang =
    (res?.contentType ?? "").includes("json") ||
    req.bodyType === "json"
      ? "json"
      : (res?.contentType ?? "").includes("xml")
        ? "xml"
        : "text";

  const responseText = res
    ? res.bodyEncoding === "base64"
      ? `[binary — ${formatSize(res.sizeBytes)}]`
      : (res.contentType ?? "").includes("json")
        ? tryPretty(res.body)
        : res.body
    : "";

  return (
    <div className="hist-detail">
      <div className="hist-detail-head">
        <div className="subtabs compact">
          <button
            className={view === "response" ? "active" : ""}
            onClick={() => setView("response")}
          >
            Response
          </button>
          <button
            className={view === "payload" ? "active" : ""}
            onClick={() => setView("payload")}
          >
            Payload
          </button>
        </div>
        <button
          className="restore-btn"
          title="Load this payload back into the request"
          onClick={() =>
            update(tab.id, {
              method: req.method,
              url: req.url,
              params: req.params,
              headers: req.headers,
              bodyType: req.bodyType,
              body: req.body,
            })
          }
        >
          ↩ Restore
        </button>
      </div>

      {view === "payload" ? (
        <div className="hist-payload">
          <div className="hist-line">
            <span className={`method-chip m-${req.method}`}>{req.method}</span>
            <span className="hist-url">{entry.resolvedUrl}</span>
          </div>
          {req.headers.filter((h) => h.key.trim() && h.enabled).length > 0 && (
            <div className="hist-kv">
              {req.headers
                .filter((h) => h.key.trim() && h.enabled)
                .map((h) => (
                  <div className="hrow" key={h.id}>
                    <span className="hkey">{h.key}</span>
                    <span className="hval">{h.value}</span>
                  </div>
                ))}
            </div>
          )}
          {req.bodyType !== "none" && req.body ? (
            <div className="hist-code">
              <CodeEditor
                value={req.body}
                language={req.bodyType === "json" ? "json" : "text"}
                readOnly
              />
            </div>
          ) : (
            <div className="empty">No request body.</div>
          )}
        </div>
      ) : entry.error ? (
        <div className="res-placeholder error">⚠ {entry.error}</div>
      ) : res ? (
        <div className="hist-response">
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
          <div className="hist-code">
            <CodeEditor value={responseText} language={bodyLang} readOnly />
          </div>
        </div>
      ) : (
        <div className="empty">No response recorded.</div>
      )}
    </div>
  );
}

function tryPretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function HistoryPanel({ tab }: { tab: RequestTab }) {
  const historyEnabled = useStore((s) => s.settings.historyEnabled);
  const setHistoryEnabled = useStore((s) => s.setHistoryEnabled);
  const loadHistoryFor = useStore((s) => s.loadHistoryFor);
  const clearHistoryFor = useStore((s) => s.clearHistoryFor);
  const entries = useStore((s) =>
    tab.nodeId ? s.history[tab.nodeId] : undefined,
  );
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (tab.nodeId && historyEnabled) loadHistoryFor(tab.nodeId);
  }, [tab.nodeId, historyEnabled, loadHistoryFor]);

  if (!tab.nodeId) {
    return (
      <div className="empty">
        Save this request to a project (⊕ in the sidebar, or the Save button) to
        keep a history of its responses.
      </div>
    );
  }

  if (!historyEnabled) {
    return (
      <div className="hist-off">
        <p>History recording is turned off.</p>
        <button className="save-btn" onClick={() => setHistoryEnabled(true)}>
          Enable history
        </button>
      </div>
    );
  }

  const list = entries ? [...entries].reverse() : [];
  const active = list.find((e) => e.id === selected) ?? list[0];

  return (
    <div className="history">
      <div className="history-list">
        <div className="history-list-head">
          <span>{list.length} recorded</span>
          {list.length > 0 && (
            <button
              className="clear-hist"
              title="Clear this request's history"
              onClick={() => {
                clearHistoryFor(tab.nodeId!);
                setSelected(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <div className="empty">
            No history yet. Send this request to record one.
          </div>
        ) : (
          list.map((e) => {
            const isActive = active?.id === e.id;
            return (
              <div
                key={e.id}
                className={`hist-row ${isActive ? "active" : ""}`}
                onClick={() => setSelected(e.id)}
              >
                {e.error ? (
                  <span className="pill server-err">ERR</span>
                ) : (
                  <span className={`pill ${statusClass(e.response!.status)}`}>
                    {e.response!.status}
                  </span>
                )}
                <span className="hist-time">{timeAgo(e.at)}</span>
                {e.response && (
                  <span className="hist-dur">{e.response.timeMs} ms</span>
                )}
              </div>
            );
          })
        )}
      </div>
      {active && <EntryDetail tab={tab} entry={active} />}
    </div>
  );
}
