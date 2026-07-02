import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  BodyType,
  KeyValue,
  Method,
  Project,
  RequestData,
  RequestTab,
  TreeNode,
} from "./types";
import {
  deleteProject as apiDeleteProject,
  listProjects,
  saveProject,
  sendRequest,
} from "./lib/api";

const CONTENT_TYPES: Record<BodyType, string | null> = {
  none: null,
  json: "application/json",
  text: "text/plain",
  xml: "application/xml",
  form: "application/x-www-form-urlencoded",
};

const REQUEST_KEYS: (keyof RequestData)[] = [
  "method",
  "url",
  "params",
  "headers",
  "bodyType",
  "body",
];

function emptyRow(): KeyValue {
  return { id: nanoid(), key: "", value: "", enabled: true };
}

function emptyRequest(): RequestData {
  return {
    method: "GET",
    url: "",
    params: [emptyRow()],
    headers: [emptyRow()],
    bodyType: "none",
    body: "",
  };
}

export function newTab(): RequestTab {
  return { id: nanoid(), name: "Untitled", loading: false, ...emptyRequest() };
}

function extractRequest(tab: RequestTab): RequestData {
  return {
    method: tab.method,
    url: tab.url,
    params: tab.params,
    headers: tab.headers,
    bodyType: tab.bodyType,
    body: tab.body,
  };
}

// ---- immutable tree helpers ----

function mapNode(
  nodes: TreeNode[],
  id: string,
  fn: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.children) return { ...n, children: mapNode(n.children, id, fn) };
    return n;
  });
}

function removeNode(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) =>
      n.children ? { ...n, children: removeNode(n.children, id) } : n,
    );
}

function insertChild(
  nodes: TreeNode[],
  parentId: string | null,
  child: TreeNode,
): TreeNode[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) => {
    if (n.id === parentId && n.type === "folder") {
      return { ...n, children: [...(n.children ?? []), child] };
    }
    if (n.children) {
      return { ...n, children: insertChild(n.children, parentId, child) };
    }
    return n;
  });
}

function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// ---- debounced persistence ----

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePersist(getProject: () => Project | undefined, id: string) {
  const existing = saveTimers.get(id);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    id,
    setTimeout(() => {
      saveTimers.delete(id);
      const project = getProject();
      if (project) saveProject(project).catch((e) => console.error(e));
    }, 400),
  );
}

interface AppState {
  ready: boolean;
  tabs: RequestTab[];
  activeId: string;
  projects: Project[];
  expanded: Record<string, boolean>;

  init: () => Promise<void>;

  // tabs
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  update: (id: string, patch: Partial<RequestTab>) => void;
  send: (id: string) => Promise<void>;

  // sidebar / tree
  toggleExpand: (id: string) => void;
  createProject: (name?: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  addFolder: (projectId: string, parentId: string | null) => void;
  addRequest: (projectId: string, parentId: string | null) => void;
  renameNode: (projectId: string, nodeId: string, name: string) => void;
  deleteNode: (projectId: string, nodeId: string) => void;
  openRequest: (projectId: string, nodeId: string) => void;
  saveScratchTab: (tabId: string) => void;
}

const first = newTab();

export const useStore = create<AppState>((set, get) => {
  /** Persist a project by id (debounced). */
  function persist(projectId: string) {
    schedulePersist(
      () => get().projects.find((p) => p.id === projectId),
      projectId,
    );
  }

  /** Apply a mutation to a project's node array, then persist. */
  function mutateProject(
    projectId: string,
    fn: (nodes: TreeNode[]) => TreeNode[],
  ) {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, nodes: fn(p.nodes) } : p,
      ),
    }));
    persist(projectId);
  }

  return {
    ready: false,
    tabs: [first],
    activeId: first.id,
    projects: [],
    expanded: {},

    init: async () => {
      try {
        const projects = await listProjects();
        // Expand all projects by default so the tree is visible on first load.
        const expanded: Record<string, boolean> = {};
        for (const p of projects) expanded[p.id] = true;
        set({ projects, expanded, ready: true });
      } catch (e) {
        console.error("failed to load projects", e);
        set({ ready: true });
      }
    },

    // ---- tabs ----
    addTab: () => {
      const tab = newTab();
      set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
    },

    closeTab: (id) =>
      set((s) => {
        if (s.tabs.length === 1) return s;
        const idx = s.tabs.findIndex((t) => t.id === id);
        const tabs = s.tabs.filter((t) => t.id !== id);
        const activeId =
          s.activeId === id ? tabs[Math.max(0, idx - 1)].id : s.activeId;
        return { tabs, activeId };
      }),

    setActive: (id) => set({ activeId: id }),

    update: (id, patch) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      // Write request-field edits through to the linked tree node.
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab?.projectId || !tab.nodeId) return;
      const touchesRequest = REQUEST_KEYS.some((k) => k in patch);
      if (!touchesRequest) return;
      const nodeId = tab.nodeId;
      const request = extractRequest(tab);
      mutateProject(tab.projectId, (nodes) =>
        mapNode(nodes, nodeId, (n) => ({ ...n, request })),
      );
    },

    send: async (id) => {
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab || !tab.url.trim()) return;
      get().update(id, { loading: true, error: undefined });

      const headers = tab.headers
        .filter((h) => h.key.trim())
        .map(({ key, value, enabled }) => ({ key, value, enabled }));
      const ct = CONTENT_TYPES[tab.bodyType];
      const hasCt = headers.some((h) => h.key.toLowerCase() === "content-type");
      if (ct && !hasCt && tab.bodyType !== "none") {
        headers.push({ key: "Content-Type", value: ct, enabled: true });
      }

      try {
        const response = await sendRequest({
          method: tab.method,
          url: tab.url.trim(),
          headers,
          query: tab.params
            .filter((p) => p.key.trim())
            .map(({ key, value, enabled }) => ({ key, value, enabled })),
          body: tab.bodyType === "none" ? null : tab.body,
          followRedirects: true,
        });
        get().update(id, { loading: false, response, error: undefined });
      } catch (e) {
        get().update(id, {
          loading: false,
          error: typeof e === "string" ? e : String(e),
        });
      }
    },

    // ---- sidebar / tree ----
    toggleExpand: (id) =>
      set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),

    createProject: (name = "New Project") => {
      const project: Project = { id: nanoid(), name, nodes: [], version: 1 };
      set((s) => ({
        projects: [...s.projects, project],
        expanded: { ...s.expanded, [project.id]: true },
      }));
      saveProject(project).catch((e) => console.error(e));
    },

    renameProject: (id, name) => {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
      }));
      persist(id);
    },

    deleteProject: (id) => {
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        // Unlink any open tabs that belonged to this project.
        tabs: s.tabs.map((t) =>
          t.projectId === id
            ? { ...t, projectId: undefined, nodeId: undefined }
            : t,
        ),
      }));
      apiDeleteProject(id).catch((e) => console.error(e));
    },

    addFolder: (projectId, parentId) => {
      const node: TreeNode = {
        id: nanoid(),
        name: "New Folder",
        type: "folder",
        children: [],
      };
      mutateProject(projectId, (nodes) => insertChild(nodes, parentId, node));
      if (parentId)
        set((s) => ({ expanded: { ...s.expanded, [parentId]: true } }));
    },

    addRequest: (projectId, parentId) => {
      const node: TreeNode = {
        id: nanoid(),
        name: "New Request",
        type: "request",
        request: emptyRequest(),
      };
      mutateProject(projectId, (nodes) => insertChild(nodes, parentId, node));
      if (parentId)
        set((s) => ({ expanded: { ...s.expanded, [parentId]: true } }));
      get().openRequest(projectId, node.id);
    },

    renameNode: (projectId, nodeId, name) => {
      mutateProject(projectId, (nodes) =>
        mapNode(nodes, nodeId, (n) => ({ ...n, name })),
      );
      // Keep any open tab's title in sync.
      set((s) => ({
        tabs: s.tabs.map((t) => (t.nodeId === nodeId ? { ...t, name } : t)),
      }));
    },

    deleteNode: (projectId, nodeId) => {
      mutateProject(projectId, (nodes) => removeNode(nodes, nodeId));
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.nodeId === nodeId
            ? { ...t, projectId: undefined, nodeId: undefined }
            : t,
        ),
      }));
    },

    openRequest: (projectId, nodeId) => {
      // Focus an already-open tab for this node.
      const existing = get().tabs.find((t) => t.nodeId === nodeId);
      if (existing) {
        set({ activeId: existing.id });
        return;
      }
      const project = get().projects.find((p) => p.id === projectId);
      const node = project && findNode(project.nodes, nodeId);
      if (!node || node.type !== "request" || !node.request) return;
      const tab: RequestTab = {
        id: nanoid(),
        name: node.name,
        projectId,
        nodeId,
        loading: false,
        ...node.request,
      };
      set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
    },

    saveScratchTab: (tabId) => {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.nodeId) return;

      // Ensure there's a project to save into.
      let projects = get().projects;
      let projectId = projects[0]?.id;
      if (!projectId) {
        const p: Project = {
          id: nanoid(),
          name: "My Requests",
          nodes: [],
          version: 1,
        };
        set((s) => ({
          projects: [...s.projects, p],
          expanded: { ...s.expanded, [p.id]: true },
        }));
        projectId = p.id;
      }

      const nodeId = nanoid();
      const node: TreeNode = {
        id: nodeId,
        name: tab.name === "Untitled" ? tab.url || "New Request" : tab.name,
        type: "request",
        request: extractRequest(tab),
      };
      mutateProject(projectId!, (nodes) => insertChild(nodes, null, node));
      // Link the scratch tab to the new node.
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, projectId, nodeId, name: node.name }
            : t,
        ),
      }));
    },
  };
});

/** Convenience selector for the currently active tab. */
export function useActiveTab(): RequestTab {
  return useStore((s) => s.tabs.find((t) => t.id === s.activeId)!);
}

export const METHOD_OPTIONS: Method[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
