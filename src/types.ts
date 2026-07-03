export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export const METHODS: Method[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export type BodyType = "none" | "json" | "text" | "xml" | "form";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  /** Free-text note describing this row. Metadata only — never sent. */
  note?: string;
}

/** The reusable, persistable definition of a single HTTP request. */
export interface RequestData {
  method: Method;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  body: string;
}

/** Response shape returned by the Rust `send_request` command. */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  bodyEncoding: "utf8" | "base64";
  contentType?: string;
  sizeBytes: number;
  timeMs: number;
  finalUrl: string;
}

export type NodeType = "folder" | "request";

/**
 * A node in a project's tree. Folders (controllers/groups) hold `children`;
 * requests (endpoints) hold `request`. The same recursive shape will host
 * environment folders later.
 */
export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  children?: TreeNode[];
  request?: RequestData;
}

/**
 * An environment (dev / stg / prod) inside a project. Each environment owns an
 * isolated tree of controllers and requests, so the same endpoint can differ
 * completely between environments.
 */
export interface Environment {
  id: string;
  name: string;
  nodes: TreeNode[];
  /** Per-environment variables, referenced in requests as `{{key}}`. */
  variables: KeyValue[];
}

/** A project = one microservice, containing one tree per environment. */
export interface Project {
  id: string;
  name: string;
  environments: Environment[];
  /**
   * Project-wide variables inherited by every environment. An environment's
   * own variable with the same key overrides the global one.
   */
  globals: KeyValue[];
  /** The environment highlighted as "current" (cosmetic emphasis). */
  activeEnvId: string;
  /** Schema version, to ease future migrations. */
  version: number;
}

export const DEFAULT_ENV_NAMES = ["local", "dev", "stg", "prod"];

/** One recorded send: the request payload plus its response (or error). */
export interface HistoryEntry {
  id: string;
  at: number; // epoch ms
  request: RequestData;
  /** URL after {{variable}} resolution, for quick reference. */
  resolvedUrl: string;
  response?: HttpResponse;
  error?: string;
}

/** Persisted app settings. */
export interface Settings {
  /**
   * Record & show per-request history. History is stored per-request and loaded
   * lazily (never at launch), but this switch lets you turn recording off
   * entirely if you'd rather keep things minimal.
   */
  historyEnabled: boolean;
  /** Whether the Projects sidebar is folded to a thin ribbon. */
  sidebarCollapsed: boolean;
}

/** One open request in the workspace (may be linked to a saved tree node). */
export interface RequestTab extends RequestData {
  id: string;
  name: string;
  /** When set, edits to this tab persist back to the project tree. */
  projectId?: string;
  envId?: string;
  nodeId?: string;
  // Transient response state.
  loading: boolean;
  response?: HttpResponse;
  error?: string;
}
