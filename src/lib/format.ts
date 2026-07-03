import type { BodyType } from "../types";

/** Pretty-print JSON. Returns null if the text isn't valid JSON. */
export function formatJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

/**
 * Pretty-print XML/HTML. Validates with DOMParser, then re-indents. Returns
 * null if the text isn't well-formed XML.
 */
export function formatXml(xml: string): string | null {
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<")) return null;
  try {
    const doc = new DOMParser().parseFromString(trimmed, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;
  } catch {
    return null;
  }

  const PAD = "  ";
  // Put every tag on its own line, then compute indentation.
  const withBreaks = trimmed.replace(/>\s*</g, ">\n<");
  let pad = 0;
  const out: string[] = [];
  for (const raw of withBreaks.split("\n")) {
    const node = raw.trim();
    if (!node) continue;
    const isClosing = /^<\//.test(node);
    const isSelfContained = /^<[^!?][^>]*>.*<\/[^>]+>$/.test(node); // <a>x</a>
    const isSelfClosing = /\/>$/.test(node);
    const isDecl = /^<[?!]/.test(node); // <?xml?> or <!-- -->
    const isOpening =
      /^<[^/!?]/.test(node) && !isSelfClosing && !isSelfContained && !isDecl;

    if (isClosing) pad = Math.max(0, pad - 1);
    out.push(PAD.repeat(pad) + node);
    if (isOpening) pad += 1;
  }
  return out.join("\n");
}

/**
 * Format text for the given kind. For "text"/unknown, try JSON then XML.
 * Returns null if it can't be formatted.
 */
export function formatByType(
  text: string,
  kind: BodyType | "json" | "xml" | "html" | "text",
): string | null {
  if (!text.trim()) return null;
  switch (kind) {
    case "json":
      return formatJson(text);
    case "xml":
    case "html":
      return formatXml(text);
    default:
      return formatJson(text) ?? formatXml(text);
  }
}
