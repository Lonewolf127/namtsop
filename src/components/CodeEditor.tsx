import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";

type Language = "json" | "xml" | "html" | "text";

interface Props {
  value: string;
  language?: Language;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

function langExtension(lang: Language): Extension[] {
  switch (lang) {
    case "json":
      return [json()];
    case "xml":
      return [xml()];
    case "html":
      return [html()];
    default:
      return [];
  }
}

export default function CodeEditor({
  value,
  language = "text",
  readOnly = false,
  placeholder,
  onChange,
}: Props) {
  const extensions = useMemo(() => langExtension(language), [language]);
  return (
    <CodeMirror
      value={value}
      theme={oneDark}
      height="100%"
      readOnly={readOnly}
      placeholder={placeholder}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        autocompletion: !readOnly,
      }}
      style={{ height: "100%", fontSize: "13px" }}
    />
  );
}
