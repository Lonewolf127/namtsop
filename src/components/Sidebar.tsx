import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Environment, Project, TreeNode } from "../types";

/** Inline-editable label used for project, environment and node renames. */
function EditableName({
  value,
  editing,
  onCommit,
  onCancel,
}: {
  value: string;
  editing: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, editing]);

  if (!editing) return <span className="node-name">{value}</span>;
  return (
    <input
      className="rename-input"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onCommit(draft.trim() || value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(draft.trim() || value);
        if (e.key === "Escape") onCancel();
      }}
    />
  );
}

function NodeRow({
  projectId,
  envId,
  node,
  depth,
  renamingId,
  setRenamingId,
}: {
  projectId: string;
  envId: string;
  node: TreeNode;
  depth: number;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}) {
  const {
    expanded,
    toggleExpand,
    addFolder,
    addRequest,
    renameNode,
    deleteNode,
    openRequest,
  } = useStore();
  const isFolder = node.type === "folder";
  const open = expanded[node.id];

  return (
    <div className="tree-branch">
      <div
        className={`node ${isFolder ? "folder" : "request"}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() =>
          isFolder
            ? toggleExpand(node.id)
            : openRequest(projectId, envId, node.id)
        }
      >
        {isFolder ? (
          <span className="chevron">{open ? "▾" : "▸"}</span>
        ) : (
          <span className={`method-chip m-${node.request?.method ?? "GET"}`}>
            {node.request?.method ?? "GET"}
          </span>
        )}
        <EditableName
          value={node.name}
          editing={renamingId === node.id}
          onCommit={(name) => {
            renameNode(projectId, envId, node.id, name);
            setRenamingId(null);
          }}
          onCancel={() => setRenamingId(null)}
        />
        <span className="node-actions" onClick={(e) => e.stopPropagation()}>
          {isFolder && (
            <>
              <button
                title="New request"
                onClick={() => addRequest(projectId, envId, node.id)}
              >
                ⊕
              </button>
              <button
                title="New folder"
                onClick={() => addFolder(projectId, envId, node.id)}
              >
                ▸+
              </button>
            </>
          )}
          <button title="Rename" onClick={() => setRenamingId(node.id)}>
            ✎
          </button>
          <button
            title="Delete"
            className="danger"
            onClick={() => deleteNode(projectId, envId, node.id)}
          >
            ×
          </button>
        </span>
      </div>

      {isFolder && open && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              projectId={projectId}
              envId={envId}
              node={child}
              depth={depth + 1}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvironmentRow({
  project,
  env,
  renamingId,
  setRenamingId,
}: {
  project: Project;
  env: Environment;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}) {
  const {
    expanded,
    toggleExpand,
    addFolder,
    addRequest,
    renameEnvironment,
    deleteEnvironment,
    duplicateEnvironment,
    setActiveEnv,
    openVarsEditor,
  } = useStore();
  const open = expanded[env.id];
  const isActive = project.activeEnvId === env.id;
  const varCount = env.variables.filter((v) => v.key.trim() && v.enabled).length;

  return (
    <div className="env">
      <div
        className={`node env-head ${isActive ? "active-env" : ""}`}
        style={{ paddingLeft: 22 }}
        onClick={() => toggleExpand(env.id)}
      >
        <span className="chevron">{open ? "▾" : "▸"}</span>
        <span className="env-icon">⬢</span>
        <EditableName
          value={env.name}
          editing={renamingId === env.id}
          onCommit={(name) => {
            renameEnvironment(project.id, env.id, name);
            setRenamingId(null);
          }}
          onCancel={() => setRenamingId(null)}
        />
        {isActive && <span className="active-dot" title="Active environment" />}
        {varCount > 0 && <span className="var-badge">{`{}`}{varCount}</span>}
        <span className="node-actions" onClick={(e) => e.stopPropagation()}>
          <button
            title="Edit variables"
            onClick={() => openVarsEditor(project.id, env.id)}
          >
            {"{}"}
          </button>
          <button
            title="New request"
            onClick={() => addRequest(project.id, env.id, null)}
          >
            ⊕
          </button>
          <button
            title="New folder"
            onClick={() => addFolder(project.id, env.id, null)}
          >
            ▸+
          </button>
          <button
            title="Set as active"
            onClick={() => setActiveEnv(project.id, env.id)}
          >
            ◉
          </button>
          <button
            title="Duplicate environment (copy its whole tree)"
            onClick={() => duplicateEnvironment(project.id, env.id)}
          >
            ⧉
          </button>
          <button title="Rename" onClick={() => setRenamingId(env.id)}>
            ✎
          </button>
          <button
            title="Delete environment"
            className="danger"
            onClick={() => {
              if (confirm(`Delete environment "${env.name}"?`))
                deleteEnvironment(project.id, env.id);
            }}
          >
            ×
          </button>
        </span>
      </div>

      {open && (
        <div className="tree-children">
          {env.nodes.length === 0 ? (
            <div className="empty-hint env-empty">
              Empty — add a controller (folder) or request.
            </div>
          ) : (
            env.nodes.map((node) => (
              <NodeRow
                key={node.id}
                projectId={project.id}
                envId={env.id}
                node={node}
                depth={2}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  renamingId,
  setRenamingId,
}: {
  project: Project;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}) {
  const {
    expanded,
    toggleExpand,
    addEnvironment,
    renameProject,
    deleteProject,
    openVarsEditor,
  } = useStore();
  const open = expanded[project.id];
  const globalCount = project.globals.filter(
    (v) => v.key.trim() && v.enabled,
  ).length;

  return (
    <div className="project">
      <div
        className="node project-head"
        onClick={() => toggleExpand(project.id)}
      >
        <span className="chevron">{open ? "▾" : "▸"}</span>
        <span className="proj-icon">▤</span>
        <EditableName
          value={project.name}
          editing={renamingId === project.id}
          onCommit={(name) => {
            renameProject(project.id, name);
            setRenamingId(null);
          }}
          onCancel={() => setRenamingId(null)}
        />
        {globalCount > 0 && (
          <span className="var-badge" title="Global variables">
            {"{}"}
            {globalCount}
          </span>
        )}
        <span className="node-actions" onClick={(e) => e.stopPropagation()}>
          <button
            title="Global variables"
            onClick={() => openVarsEditor(project.id)}
          >
            {"{}"}
          </button>
          <button
            title="New environment"
            onClick={() => addEnvironment(project.id)}
          >
            ⬢+
          </button>
          <button title="Rename" onClick={() => setRenamingId(project.id)}>
            ✎
          </button>
          <button
            title="Delete project"
            className="danger"
            onClick={() => {
              if (confirm(`Delete project "${project.name}"?`))
                deleteProject(project.id);
            }}
          >
            ×
          </button>
        </span>
      </div>
      {open && (
        <div className="tree-children">
          {project.environments.map((env) => (
            <EnvironmentRow
              key={env.id}
              project={project}
              env={env}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { projects, createProject } = useStore();
  const historyEnabled = useStore((s) => s.settings.historyEnabled);
  const setHistoryEnabled = useStore((s) => s.setHistoryEnabled);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>Projects</span>
        <button
          className="new-project"
          title="New project"
          onClick={() => createProject()}
        >
          +
        </button>
      </div>
      <div className="sidebar-tree">
        {projects.length === 0 ? (
          <div className="empty-hint pad">
            No projects yet. Create one — each project comes with dev, stg and
            prod environments, each with its own controllers and endpoints.
          </div>
        ) : (
          projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
            />
          ))
        )}
      </div>
      <div className="sidebar-foot">
        <label
          className="hist-toggle"
          title="Record each request's responses. Loaded lazily — off keeps things minimal."
        >
          <input
            type="checkbox"
            checked={historyEnabled}
            onChange={(e) => setHistoryEnabled(e.target.checked)}
          />
          Record request history
        </label>
      </div>
    </aside>
  );
}
