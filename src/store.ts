import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  DEFAULT_ENV_NAMES,
  type BodyType,
  type Environment,
  type HistoryEntry,
  type KeyValue,
  type Method,
  type Project,
  type RequestData,
  type RequestTab,
  type Settings,
  type TreeNode,
} from "./types";
import {
  appendHistory,
  clearHistory as apiClearHistory,
  deleteProject as apiDeleteProject,
  listProjects,
  loadHistory,
  loadSettings,
  saveSettings,
  saveProject,
  sendRequest,
} from "./lib/api";
import { buildVarMap, substitute } from "./lib/vars";

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
  return { id: nanoid(), key: "", value: "", enabled: true, note: "" };
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

function makeEnv(name: string, nodes: TreeNode[] = []): Environment {
  // Seed a `base_url` variable so new environments are immediately useful, plus
  // a trailing blank row for the key/value editor.
  return {
    id: nanoid(),
    name,
    nodes,
    variables: [
      { id: nanoid(), key: "base_url", value: "", enabled: true },
      emptyRow(),
    ],
  };
}

/** Ensure an env has a usable (non-empty) variables array after loading. */
function normalizeEnv(env: Environment): Environment {
  const variables =
    Array.isArray(env.variables) && env.variables.length > 0
      ? env.variables
      : [emptyRow()];
  return { ...env, variables };
}

/** A fresh project with the default dev/stg/prod environments. */
function makeProject(name: string): Project {
  const environments = DEFAULT_ENV_NAMES.map((n) => makeEnv(n));
  return {
    id: nanoid(),
    name,
    environments,
    globals: [emptyRow()],
    activeEnvId: environments[0].id,
    version: 2,
  };
}

/**
 * Bring a project loaded from disk up to the current schema. v1 projects stored
 * `nodes` directly on the project; move those into a `dev` environment and add
 * empty stg/prod. Returns [project, migrated?].
 */
function normalizeProject(raw: any): [Project, boolean] {
  if (Array.isArray(raw?.environments) && raw.environments.length > 0) {
    const environments = raw.environments.map(normalizeEnv);
    const activeEnvId = environments.some(
      (e: Environment) => e.id === raw.activeEnvId,
    )
      ? raw.activeEnvId
      : environments[0].id;
    const hasGlobals = Array.isArray(raw.globals) && raw.globals.length > 0;
    const globals = hasGlobals ? raw.globals : [emptyRow()];
    // Flag a migration if any env lacked variables, or globals were missing.
    const migrated =
      !hasGlobals ||
      raw.environments.some(
        (e: any) => !Array.isArray(e?.variables) || e.variables.length === 0,
      );
    return [
      { ...raw, environments, globals, activeEnvId, version: 2 } as Project,
      migrated,
    ];
  }
  // v1 → v2 migration.
  const legacyNodes: TreeNode[] = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const environments = [
    makeEnv(DEFAULT_ENV_NAMES[0], legacyNodes),
    ...DEFAULT_ENV_NAMES.slice(1).map((n) => makeEnv(n)),
  ];
  const project: Project = {
    id: raw?.id ?? nanoid(),
    name: raw?.name ?? "Untitled Project",
    environments,
    globals: [emptyRow()],
    activeEnvId: environments[0].id,
    version: 2,
  };
  return [project, true];
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

/** Deep-clone a node tree with fresh ids (used to duplicate environments). */
function cloneNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) => ({
    id: nanoid(),
    name: n.name,
    type: n.type,
    request: n.request
      ? {
          ...n.request,
          params: n.request.params.map((p) => ({ ...p, id: nanoid() })),
          headers: n.request.headers.map((h) => ({ ...h, id: nanoid() })),
        }
      : undefined,
    children: n.children ? cloneNodes(n.children) : undefined,
  }));
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
  settings: Settings;
  /** Lazily-loaded history cache, keyed by request node id. */
  history: Record<string, HistoryEntry[]>;

  init: () => Promise<void>;

  // settings & history
  setHistoryEnabled: (enabled: boolean) => void;
  loadHistoryFor: (nodeId: string) => Promise<void>;
  clearHistoryFor: (nodeId: string) => void;

  // tabs
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  update: (id: string, patch: Partial<RequestTab>) => void;
  send: (id: string) => Promise<void>;

  // drag & drop (ephemeral: id of the current drop target for highlighting)
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;

  // sidebar / tree
  toggleExpand: (id: string) => void;
  createProject: (name?: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;

  // environments
  addEnvironment: (projectId: string, name?: string) => void;
  renameEnvironment: (projectId: string, envId: string, name: string) => void;
  deleteEnvironment: (projectId: string, envId: string) => void;
  duplicateEnvironment: (projectId: string, envId: string) => void;
  setActiveEnv: (projectId: string, envId: string) => void;

  // variables editor (envId present → environment vars; absent → project globals)
  varsEditor: { projectId: string; envId?: string } | null;
  openVarsEditor: (projectId: string, envId?: string) => void;
  closeVarsEditor: () => void;
  setEnvVariables: (
    projectId: string,
    envId: string,
    variables: KeyValue[],
  ) => void;
  setProjectGlobals: (projectId: string, globals: KeyValue[]) => void;

  // nodes (scoped to an environment)
  addFolder: (projectId: string, envId: string, parentId: string | null) => void;
  addRequest: (
    projectId: string,
    envId: string,
    parentId: string | null,
  ) => void;
  renameNode: (
    projectId: string,
    envId: string,
    nodeId: string,
    name: string,
  ) => void;
  deleteNode: (projectId: string, envId: string, nodeId: string) => void;
  /**
   * Move a node (drag & drop) within a project. `toParentId` null = env root.
   * Source and target environments may differ.
   */
  moveNode: (
    projectId: string,
    fromEnvId: string,
    nodeId: string,
    toEnvId: string,
    toParentId: string | null,
  ) => void;
  openRequest: (projectId: string, envId: string, nodeId: string) => void;
  saveScratchTab: (tabId: string) => void;
}

const first = newTab();

export const useStore = create<AppState>((set, get) => {
  function persist(projectId: string) {
    schedulePersist(
      () => get().projects.find((p) => p.id === projectId),
      projectId,
    );
  }

  /** Apply a mutation to one environment's node tree, then persist. */
  function mutateEnv(
    projectId: string,
    envId: string,
    fn: (nodes: TreeNode[]) => TreeNode[],
  ) {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              environments: p.environments.map((e) =>
                e.id === envId ? { ...e, nodes: fn(e.nodes) } : e,
              ),
            }
          : p,
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
    settings: { historyEnabled: true },
    history: {},

    init: async () => {
      // Settings are tiny; history is NOT loaded here (lazy per request).
      try {
        const s = await loadSettings();
        if (typeof s.historyEnabled === "boolean")
          set({ settings: { historyEnabled: s.historyEnabled } });
      } catch (e) {
        console.error("failed to load settings", e);
      }
      try {
        const raw = await listProjects();
        const expanded: Record<string, boolean> = {};
        const projects: Project[] = [];
        for (const r of raw) {
          const [project, migrated] = normalizeProject(r);
          projects.push(project);
          expanded[project.id] = true;
          expanded[project.activeEnvId] = true;
          if (migrated) saveProject(project).catch((e) => console.error(e));
        }
        set({ projects, expanded, ready: true });
      } catch (e) {
        console.error("failed to load projects", e);
        set({ ready: true });
      }
    },

    // ---- settings & history ----
    setHistoryEnabled: (enabled) => {
      const settings = { historyEnabled: enabled };
      set({ settings });
      saveSettings(settings).catch((e) => console.error(e));
    },

    loadHistoryFor: async (nodeId) => {
      if (get().history[nodeId]) return; // already cached
      try {
        const entries = await loadHistory(nodeId);
        set((s) => ({ history: { ...s.history, [nodeId]: entries } }));
      } catch (e) {
        console.error("failed to load history", e);
        set((s) => ({ history: { ...s.history, [nodeId]: [] } }));
      }
    },

    clearHistoryFor: (nodeId) => {
      set((s) => ({ history: { ...s.history, [nodeId]: [] } }));
      apiClearHistory(nodeId).catch((e) => console.error(e));
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
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab?.projectId || !tab.envId || !tab.nodeId) return;
      if (!REQUEST_KEYS.some((k) => k in patch)) return;
      const nodeId = tab.nodeId;
      const request = extractRequest(tab);
      mutateEnv(tab.projectId, tab.envId, (nodes) =>
        mapNode(nodes, nodeId, (n) => ({ ...n, request })),
      );
    },

    send: async (id) => {
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab || !tab.url.trim()) return;
      get().update(id, { loading: true, error: undefined });

      // Resolve {{variables}}: project globals first, then the request's own
      // environment overrides them.
      const project = get().projects.find((p) => p.id === tab.projectId);
      const env = project?.environments.find((e) => e.id === tab.envId);
      const vars = {
        ...buildVarMap(project?.globals ?? []),
        ...buildVarMap(env?.variables ?? []),
      };
      const sub = (t: string) => substitute(t, vars);

      const headers = tab.headers
        .filter((h) => h.key.trim())
        .map(({ key, value, enabled }) => ({
          key: sub(key),
          value: sub(value),
          enabled,
        }));
      const ct = CONTENT_TYPES[tab.bodyType];
      const hasCt = headers.some((h) => h.key.toLowerCase() === "content-type");
      if (ct && !hasCt && tab.bodyType !== "none") {
        headers.push({ key: "Content-Type", value: ct, enabled: true });
      }

      const resolvedUrl = sub(tab.url.trim());
      const snapshot = extractRequest(tab);

      // Record a history entry (in-memory + on disk) if enabled and this is a
      // saved request. Errors are recorded too.
      const record = (patch: Partial<HistoryEntry>) => {
        if (!get().settings.historyEnabled || !tab.nodeId) return;
        const nodeId = tab.nodeId;
        const entry: HistoryEntry = {
          id: nanoid(),
          at: Date.now(),
          request: snapshot,
          resolvedUrl,
          ...patch,
        };
        set((s) => ({
          history: {
            ...s.history,
            [nodeId]: [...(s.history[nodeId] ?? []), entry].slice(-50),
          },
        }));
        appendHistory(nodeId, entry).catch((e) => console.error(e));
      };

      try {
        const response = await sendRequest({
          method: tab.method,
          url: resolvedUrl,
          headers,
          query: tab.params
            .filter((p) => p.key.trim())
            .map(({ key, value, enabled }) => ({
              key: sub(key),
              value: sub(value),
              enabled,
            })),
          body: tab.bodyType === "none" ? null : sub(tab.body),
          followRedirects: true,
        });
        get().update(id, { loading: false, response, error: undefined });
        record({ response });
      } catch (e) {
        const error = typeof e === "string" ? e : String(e);
        get().update(id, { loading: false, error });
        record({ error });
      }
    },

    // ---- drag & drop ----
    dragOverId: null,
    setDragOverId: (id) => set({ dragOverId: id }),

    // ---- sidebar / tree ----
    toggleExpand: (id) =>
      set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),

    createProject: (name = "New Project") => {
      const project = makeProject(name);
      set((s) => ({
        projects: [...s.projects, project],
        expanded: {
          ...s.expanded,
          [project.id]: true,
          [project.activeEnvId]: true,
        },
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
        tabs: s.tabs.map((t) =>
          t.projectId === id
            ? { ...t, projectId: undefined, envId: undefined, nodeId: undefined }
            : t,
        ),
      }));
      apiDeleteProject(id).catch((e) => console.error(e));
    },

    // ---- environments ----
    addEnvironment: (projectId, name = "new-env") => {
      const env = makeEnv(name);
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId
            ? { ...p, environments: [...p.environments, env] }
            : p,
        ),
        expanded: { ...s.expanded, [env.id]: true },
      }));
      persist(projectId);
    },

    renameEnvironment: (projectId, envId, name) => {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                environments: p.environments.map((e) =>
                  e.id === envId ? { ...e, name } : e,
                ),
              }
            : p,
        ),
      }));
      persist(projectId);
    },

    deleteEnvironment: (projectId, envId) => {
      set((s) => ({
        projects: s.projects.map((p) => {
          if (p.id !== projectId) return p;
          if (p.environments.length <= 1) return p; // keep at least one
          const environments = p.environments.filter((e) => e.id !== envId);
          const activeEnvId =
            p.activeEnvId === envId ? environments[0].id : p.activeEnvId;
          return { ...p, environments, activeEnvId };
        }),
        tabs: s.tabs.map((t) =>
          t.envId === envId
            ? { ...t, projectId: undefined, envId: undefined, nodeId: undefined }
            : t,
        ),
      }));
      persist(projectId);
    },

    duplicateEnvironment: (projectId, envId) => {
      let newEnvId: string | undefined;
      set((s) => ({
        projects: s.projects.map((p) => {
          if (p.id !== projectId) return p;
          const src = p.environments.find((e) => e.id === envId);
          if (!src) return p;
          const copy = makeEnv(`${src.name}-copy`, cloneNodes(src.nodes));
          newEnvId = copy.id;
          return { ...p, environments: [...p.environments, copy] };
        }),
      }));
      if (newEnvId)
        set((s) => ({ expanded: { ...s.expanded, [newEnvId!]: true } }));
      persist(projectId);
    },

    setActiveEnv: (projectId, envId) => {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, activeEnvId: envId } : p,
        ),
        expanded: { ...s.expanded, [envId]: true },
      }));
      persist(projectId);
    },

    // ---- variables editor ----
    varsEditor: null,
    openVarsEditor: (projectId, envId) =>
      set({ varsEditor: { projectId, envId } }),
    closeVarsEditor: () => set({ varsEditor: null }),

    setEnvVariables: (projectId, envId, variables) => {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                environments: p.environments.map((e) =>
                  e.id === envId ? { ...e, variables } : e,
                ),
              }
            : p,
        ),
      }));
      persist(projectId);
    },

    setProjectGlobals: (projectId, globals) => {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, globals } : p,
        ),
      }));
      persist(projectId);
    },

    // ---- nodes ----
    addFolder: (projectId, envId, parentId) => {
      const node: TreeNode = {
        id: nanoid(),
        name: "New Folder",
        type: "folder",
        children: [],
      };
      mutateEnv(projectId, envId, (nodes) =>
        insertChild(nodes, parentId, node),
      );
      const openKey = parentId ?? envId;
      set((s) => ({ expanded: { ...s.expanded, [openKey]: true } }));
    },

    addRequest: (projectId, envId, parentId) => {
      const node: TreeNode = {
        id: nanoid(),
        name: "New Request",
        type: "request",
        request: emptyRequest(),
      };
      mutateEnv(projectId, envId, (nodes) =>
        insertChild(nodes, parentId, node),
      );
      const openKey = parentId ?? envId;
      set((s) => ({ expanded: { ...s.expanded, [openKey]: true } }));
      get().openRequest(projectId, envId, node.id);
    },

    renameNode: (projectId, envId, nodeId, name) => {
      mutateEnv(projectId, envId, (nodes) =>
        mapNode(nodes, nodeId, (n) => ({ ...n, name })),
      );
      set((s) => ({
        tabs: s.tabs.map((t) => (t.nodeId === nodeId ? { ...t, name } : t)),
      }));
    },

    deleteNode: (projectId, envId, nodeId) => {
      // Collect request ids in the removed subtree so we can drop their history.
      const project = get().projects.find((p) => p.id === projectId);
      const env = project?.environments.find((e) => e.id === envId);
      const target = env && findNode(env.nodes, nodeId);
      const requestIds: string[] = [];
      const collect = (n: TreeNode) => {
        if (n.type === "request") requestIds.push(n.id);
        n.children?.forEach(collect);
      };
      if (target) collect(target);

      mutateEnv(projectId, envId, (nodes) => removeNode(nodes, nodeId));
      set((s) => {
        const history = { ...s.history };
        for (const rid of requestIds) delete history[rid];
        return {
          history,
          tabs: s.tabs.map((t) =>
            t.nodeId === nodeId
              ? {
                  ...t,
                  projectId: undefined,
                  envId: undefined,
                  nodeId: undefined,
                }
              : t,
          ),
        };
      });
      for (const rid of requestIds) apiClearHistory(rid).catch(() => {});
    },

    moveNode: (projectId, fromEnvId, nodeId, toEnvId, toParentId) => {
      set((s) => {
        const project = s.projects.find((p) => p.id === projectId);
        const fromEnv = project?.environments.find((e) => e.id === fromEnvId);
        const node = fromEnv && findNode(fromEnv.nodes, nodeId);
        if (!project || !fromEnv || !node) return s;

        // Collect the moved subtree's ids (for cycle check + tab re-linking).
        const movedIds = new Set<string>();
        const collect = (n: TreeNode) => {
          movedIds.add(n.id);
          n.children?.forEach(collect);
        };
        collect(node);

        // Can't drop a folder into itself or one of its descendants, and
        // dropping onto itself is a no-op.
        if (toParentId && movedIds.has(toParentId)) return s;

        const environments = project.environments.map((e) => {
          if (e.id === fromEnvId && e.id === toEnvId) {
            return {
              ...e,
              nodes: insertChild(removeNode(e.nodes, nodeId), toParentId, node),
            };
          }
          if (e.id === fromEnvId) {
            return { ...e, nodes: removeNode(e.nodes, nodeId) };
          }
          if (e.id === toEnvId) {
            return { ...e, nodes: insertChild(e.nodes, toParentId, node) };
          }
          return e;
        });

        // If moved across environments, re-point any open tabs to the new env.
        const tabs =
          fromEnvId === toEnvId
            ? s.tabs
            : s.tabs.map((t) =>
                t.nodeId && movedIds.has(t.nodeId)
                  ? { ...t, envId: toEnvId }
                  : t,
              );

        return {
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, environments } : p,
          ),
          tabs,
          expanded: {
            ...s.expanded,
            [toParentId ?? toEnvId]: true,
          },
        };
      });
      persist(projectId);
    },

    openRequest: (projectId, envId, nodeId) => {
      const existing = get().tabs.find((t) => t.nodeId === nodeId);
      if (existing) {
        set({ activeId: existing.id });
        return;
      }
      const project = get().projects.find((p) => p.id === projectId);
      const env = project?.environments.find((e) => e.id === envId);
      const node = env && findNode(env.nodes, nodeId);
      if (!node || node.type !== "request" || !node.request) return;
      const tab: RequestTab = {
        id: nanoid(),
        name: node.name,
        projectId,
        envId,
        nodeId,
        loading: false,
        ...node.request,
      };
      set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
    },

    saveScratchTab: (tabId) => {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab || tab.nodeId) return;

      // Ensure there's a project + environment to save into.
      let project = get().projects[0];
      if (!project) {
        project = makeProject("My Requests");
        set((s) => ({
          projects: [...s.projects, project],
          expanded: {
            ...s.expanded,
            [project.id]: true,
            [project.activeEnvId]: true,
          },
        }));
      }
      const projectId = project.id;
      const envId = project.activeEnvId;

      const nodeId = nanoid();
      const node: TreeNode = {
        id: nodeId,
        name: tab.name === "Untitled" ? tab.url || "New Request" : tab.name,
        type: "request",
        request: extractRequest(tab),
      };
      mutateEnv(projectId, envId, (nodes) => insertChild(nodes, null, node));
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, projectId, envId, nodeId, name: node.name }
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
