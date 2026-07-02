import { invoke } from "@tauri-apps/api/core";
import type { HttpResponse, Project } from "../types";

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
