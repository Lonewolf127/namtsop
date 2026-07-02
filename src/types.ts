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

/** A project = one microservice's collection of controllers and endpoints. */
export interface Project {
  id: string;
  name: string;
  nodes: TreeNode[];
  /** Schema version, to ease future migrations (e.g. environments). */
  version: number;
}

/** One open request in the workspace (may be linked to a saved tree node). */
export interface RequestTab extends RequestData {
  id: string;
  name: string;
  /** When set, edits to this tab persist back to the project tree. */
  projectId?: string;
  nodeId?: string;
  // Transient response state.
  loading: boolean;
  response?: HttpResponse;
  error?: string;
}
