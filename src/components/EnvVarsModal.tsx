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

  const ctx = useStore((s) => {
    if (!s.varsEditor) return undefined;
    const project = s.projects.find((p) => p.id === s.varsEditor!.projectId);
    if (!project) return undefined;
    const env = s.varsEditor!.envId
      ? project.environments.find((e) => e.id === s.varsEditor!.envId)
      : undefined;
    if (s.varsEditor!.envId && !env) return undefined;
    return { project, env };
  });

  if (!editor || !ctx) return null;
  const { project, env } = ctx;
  const isGlobals = !env;

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
