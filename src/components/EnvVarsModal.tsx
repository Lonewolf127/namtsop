import { useStore } from "../store";
import KeyValueEditor from "./KeyValueEditor";
import { buildVarMap } from "../lib/vars";

/**
 * Modal for editing variables. Opened from the sidebar:
 *  - on an environment (`envId` set) → that environment's variables
 *  - on a project (`envId` absent)   → the project's global variables
 *
 * Environment variables override project globals with the same key.
 */
export default function EnvVarsModal() {
  const editor = useStore((s) => s.varsEditor);
  const close = useStore((s) => s.closeVarsEditor);
  const setEnvVariables = useStore((s) => s.setEnvVariables);
  const setProjectGlobals = useStore((s) => s.setProjectGlobals);

  // Stable-reference selectors (never build a new object in a selector, or
  // useSyncExternalStore loops infinitely).
  const project = useStore((s) =>
    s.varsEditor
      ? s.projects.find((p) => p.id === s.varsEditor!.projectId)
      : undefined,
  );
  const env = useStore((s) => {
    const ed = s.varsEditor;
    if (!ed || !ed.envId) return undefined;
    return s.projects
      .find((p) => p.id === ed.projectId)
      ?.environments.find((e) => e.id === ed.envId);
  });

  if (!editor || !project) return null;
  // Editing an environment but it wasn't found → nothing to show.
  if (editor.envId && !env) return null;
  const isGlobals = !editor.envId;

  // For an environment editor, list globals it inherits but doesn't override.
  const inherited = env
    ? Object.keys(buildVarMap(project.globals)).filter(
        (k) => !buildVarMap(env.variables)[k],
      )
    : [];

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-title">
              {isGlobals ? "Global variables" : "Variables"}
            </span>
            <span className="modal-sub">
              {project.name}
              {env && (
                <>
                  {" · "}
                  <span className="env-tag">{env.name}</span>
                </>
              )}
            </span>
          </div>
          <button className="modal-close" onClick={close} aria-label="close">
            ×
          </button>
        </div>

        <p className="modal-hint">
          {isGlobals ? (
            <>
              Shared across <b>every environment</b> in this project. An
              environment variable with the same key overrides the global one.
              Reference as <code>{"{{key}}"}</code>.
            </>
          ) : (
            <>
              Specific to the <b>{env!.name}</b> environment; overrides project
              globals. Reference as <code>{"{{key}}"}</code>.
            </>
          )}
        </p>

        {inherited.length > 0 && (
          <div className="inherited">
            Inherited globals:{" "}
            {inherited.map((k) => (
              <code key={k} className="inherited-tag">
                {k}
              </code>
            ))}
          </div>
        )}

        <div className="modal-body">
          <KeyValueEditor
            rows={isGlobals ? project.globals : env!.variables}
            keyPlaceholder="Variable name"
            valuePlaceholder="Value"
            onChange={(rows) =>
              isGlobals
                ? setProjectGlobals(project.id, rows)
                : setEnvVariables(project.id, env!.id, rows)
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
