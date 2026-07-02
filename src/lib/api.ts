import { invoke } from "@tauri-apps/api/core";
import type { HistoryEntry, HttpResponse, Project, Settings } from "../types";

/** Payload sent to the Rust engine (matches serde `HttpRequest`). */
export interface SendRequestPayload {
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  query: { key: string; value: string; enabled: boolean }[];
  body?: string | null;
  timeoutMs?: number | null;
  followRedirects: boolean;
}

/** Fire an HTTP request through the native Rust client. */
export function sendRequest(req: SendRequestPayload): Promise<HttpResponse> {
  return invoke<HttpResponse>("send_request", { req });
}

// ---- Project persistence (Rust storage commands) ----

export function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export function saveProject(project: Project): Promise<void> {
  return invoke("save_project", { project });
}

export function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
}

// ---- settings ----

export function loadSettings(): Promise<Partial<Settings>> {
  return invoke<Partial<Settings>>("load_settings");
}

export function saveSettings(settings: Settings): Promise<void> {
  return invoke("save_settings", { settings });
}

// ---- per-request history ----

export function loadHistory(nodeId: string): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("load_history", { nodeId });
}

export function appendHistory(
  nodeId: string,
  entry: HistoryEntry,
): Promise<void> {
  return invoke("append_history", { nodeId, entry });
}

export function clearHistory(nodeId: string): Promise<void> {
  return invoke("clear_history", { nodeId });
}
