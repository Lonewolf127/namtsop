import { useEffect } from "react";
import { useStore, useActiveTab, METHOD_OPTIONS } from "./store";
import type { RequestTab } from "./types";
import Sidebar from "./components/Sidebar";
import MenuBar from "./components/MenuBar";
import RequestPanel from "./components/RequestPanel";
import ResponsePanel from "./components/ResponsePanel";
import ScratchEditor from "./components/ScratchEditor";
import EnvVarsModal from "./components/EnvVarsModal";
import { buildVarMap, substitute } from "./lib/vars";
import "./styles.css";

function TabBar() {
  const { tabs, activeId, setActive, addTab, closeTab, addScratchFile } =
    useStore();
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${t.id === activeId ? "active" : ""}`}
          onClick={() => setActive(t.id)}
        >
          {t.kind === "request" ? (
            <span className={`method-chip m-${t.method}`}>{t.method}</span>
          ) : (
            <span className="scratch-chip">✎</span>
          )}
          <span className="tab-name">
            {t.name || (t.kind === "request" ? t.url : "") || "Untitled"}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(t.id);
            }}
            aria-label="close tab"
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-add" onClick={addTab} title="New request">
        +
      </button>
      <button
        className="tab-add scratch"
        onClick={addScratchFile}
        title="New scratch file"
      >
        ✎
      </button>
    </div>
  );
}

function UrlBar({ tab }: { tab: RequestTab }) {
  const update = useStore((s) => s.update);
  const send = useStore((s) => s.send);
  const saveScratchTab = useStore((s) => s.saveScratchTab);
  // Resolve the environment + project globals for the linked tab (stable refs).
  const project = useStore((s) =>
    tab.projectId ? s.projects.find((p) => p.id === tab.projectId) : undefined,
  );
  const env = useStore((s) => {
    if (!tab.projectId || !tab.envId) return undefined;
    return s.projects
      .find((p) => p.id === tab.projectId)
      ?.environments.find((e) => e.id === tab.envId);
  });
  const envName = env?.name;

  const resolvedUrl =
    project && env && tab.url.includes("{{")
      ? substitute(tab.url, {
          ...buildVarMap(project.globals),
          ...buildVarMap(env.variables),
        })
      : null;
  const showPreview = resolvedUrl !== null && resolvedUrl !== tab.url;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") send(tab.id);
  }

  return (
    <div className="urlbar-wrap">
      <div className="urlbar">
        <select
          className={`method-select m-${tab.method}`}
          value={tab.method}
          onChange={(e) => update(tab.id, { method: e.target.value as any })}
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="url-input"
          placeholder="https://api.example.com/endpoint"
          value={tab.url}
          spellCheck={false}
          onChange={(e) => update(tab.id, { url: e.target.value })}
          onKeyDown={onKeyDown}
        />
        <button
          className="send-btn"
          disabled={tab.loading || !tab.url.trim()}
          onClick={() => send(tab.id)}
        >
          {tab.loading ? "Sending…" : "Send"}
        </button>
        {tab.nodeId ? (
          <span
            className="saved-pill"
            title="Saved to a project — edits auto-save"
          >
            Saved{envName ? ` · ${envName}` : ""}
          </span>
        ) : (
          <button
            className="save-btn"
            title="Save this request into a project"
            onClick={() => saveScratchTab(tab.id)}
          >
            Save
          </button>
        )}
      </div>
      {showPreview && (
        <div className="url-preview" title="URL with variables resolved">
          <span className="url-preview-arrow">→</span> {resolvedUrl}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const tab = useActiveTab();
  const init = useStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="app-shell">
      <MenuBar />
      <div className="app">
        <Sidebar />
        <div className="main">
          <TabBar />
          {tab.kind === "scratch" ? (
            <ScratchEditor scratchId={tab.scratchId} />
          ) : (
            <>
              <UrlBar tab={tab} />
              <div className="workspace">
                <RequestPanel tab={tab} />
                <div className="divider" />
                <ResponsePanel tab={tab} />
              </div>
            </>
          )}
        </div>
        <EnvVarsModal />
      </div>
    </div>
  );
}
