import { useStore } from "../store";
import KeyValueEditor from "./KeyValueEditor";

/**
 * Modal for editing one environment's variables. Opened from the sidebar's
 * `{}` action. Variables are referenced in requests as `{{key}}` and resolved
 * against this environment at send time.
 */
export default function EnvVarsModal() {
  const editor = useStore((s) => s.varsEditor);
  const close = useStore((s) => s.closeVarsEditor);
  const setEnvVariables = useStore((s) => s.setEnvVariables);

  const ctx = useStore((s) => {
    if (!s.varsEditor) return undefined;
    const project = s.projects.find((p) => p.id === s.varsEditor!.projectId);
    const env = project?.environments.find(
      (e) => e.id === s.varsEditor!.envId,
    );
    return project && env ? { project, env } : undefined;
  });

  if (!editor || !ctx) return null;
  const { project, env } = ctx;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-title">Variables</span>
            <span className="modal-sub">
              {project.name} · <span className="env-tag">{env.name}</span>
            </span>
          </div>
          <button className="modal-close" onClick={close} aria-label="close">
            ×
          </button>
        </div>
        <p className="modal-hint">
          Reference these in a request's URL, headers or body as{" "}
          <code>{"{{key}}"}</code>. Values are specific to the{" "}
          <b>{env.name}</b> environment.
        </p>
        <div className="modal-body">
          <KeyValueEditor
            rows={env.variables}
            keyPlaceholder="Variable name"
            valuePlaceholder="Value"
            onChange={(rows) =>
              setEnvVariables(editor.projectId, editor.envId, rows)
            }
          />
        </div>
        <div className="modal-foot">
          <button className="modal-done" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
