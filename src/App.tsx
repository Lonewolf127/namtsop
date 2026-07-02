import { useEffect } from "react";
import { useStore, useActiveTab, METHOD_OPTIONS } from "./store";
import Sidebar from "./components/Sidebar";
import RequestPanel from "./components/RequestPanel";
import ResponsePanel from "./components/ResponsePanel";
import "./styles.css";

function TabBar() {
  const { tabs, activeId, setActive, addTab, closeTab } = useStore();
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${t.id === activeId ? "active" : ""}`}
          onClick={() => setActive(t.id)}
        >
          <span className={`method-chip m-${t.method}`}>{t.method}</span>
          <span className="tab-name">{t.name || t.url || "Untitled"}</span>
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
    </div>
  );
}

function UrlBar() {
  const tab = useActiveTab();
  const update = useStore((s) => s.update);
  const send = useStore((s) => s.send);
  const saveScratchTab = useStore((s) => s.saveScratchTab);
  // Resolve the environment label for the "Saved" pill.
  const envName = useStore((s) => {
    if (!tab.projectId || !tab.envId) return undefined;
    const project = s.projects.find((p) => p.id === tab.projectId);
    return project?.environments.find((e) => e.id === tab.envId)?.name;
  });

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") send(tab.id);
  }

  return (
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
  );
}

export default function App() {
  const tab = useActiveTab();
  const init = useStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TabBar />
        <UrlBar />
        <div className="workspace">
          <RequestPanel tab={tab} />
          <div className="divider" />
          <ResponsePanel tab={tab} />
        </div>
      </div>
    </div>
  );
}
