import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Project, TreeNode } from "../types";

/** Inline-editable label used for project and node renames. */
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
  node,
  depth,
  renamingId,
  setRenamingId,
}: {
  projectId: string;
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
          isFolder ? toggleExpand(node.id) : openRequest(projectId, node.id)
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
            renameNode(projectId, node.id, name);
            setRenamingId(null);
          }}
          onCancel={() => setRenamingId(null)}
        />
        <span className="node-actions" onClick={(e) => e.stopPropagation()}>
          {isFolder && (
            <>
              <button
                title="New request"
                onClick={() => addRequest(projectId, node.id)}
              >
                ⊕
              </button>
              <button
                title="New folder"
                onClick={() => addFolder(projectId, node.id)}
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
            onClick={() => deleteNode(projectId, node.id)}
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
    addFolder,
    addRequest,
    renameProject,
    deleteProject,
  } = useStore();
  const open = expanded[project.id];

  return (
    <div className="project">
      <div className="node project-head" onClick={() => toggleExpand(project.id)}>
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
        <span className="node-actions" onClick={(e) => e.stopPropagation()}>
          <button
            title="New request"
            onClick={() => addRequest(project.id, null)}
          >
            ⊕
          </button>
          <button title="New folder" onClick={() => addFolder(project.id, null)}>
            ▸+
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
          {project.nodes.length === 0 ? (
            <div className="empty-hint">Empty — add a request or folder.</div>
          ) : (
            project.nodes.map((node) => (
              <NodeRow
                key={node.id}
                projectId={project.id}
                node={node}
                depth={1}
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

export default function Sidebar() {
  const { projects, createProject } = useStore();
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
            No projects yet. Create one to organize your requests into
            controllers and endpoints.
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
    </aside>
  );
}
