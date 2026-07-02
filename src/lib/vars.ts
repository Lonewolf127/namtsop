import type { KeyValue } from "../types";

/** Build a `{ name: value }` lookup from an environment's enabled variables. */
export function buildVarMap(vars: KeyValue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of vars) {
    const key = v.key.trim();
    if (v.enabled && key) map[key] = v.value;
  }
  return map;
}

const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Replace `{{name}}` occurrences with values from `map`. Unknown variables are
 * left untouched (so an undefined variable is visible rather than silently
 * blanked).
 */
export function substitute(text: string, map: Record<string, string>): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(VAR_RE, (whole, name) =>
    Object.prototype.hasOwnProperty.call(map, name) ? map[name] : whole,
  );
}

/** True if the text references at least one `{{variable}}`. */
export function hasVars(text: string): boolean {
  return !!text && /\{\{\s*[\w.-]+\s*\}\}/.test(text);
}
