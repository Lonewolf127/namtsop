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
  /** The environment highlighted as "current" (cosmetic emphasis). */
  activeEnvId: string;
  /** Schema version, to ease future migrations. */
  version: number;
}

export const DEFAULT_ENV_NAMES = ["dev", "stg", "prod"];

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
