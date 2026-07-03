import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useStore } from "../store";

type Menu = "file" | "help" | "settings" | null;

const REPO_URL = "https://github.com/Lonewolf127/namtsop";
// Change this to your own donation link (Sponsors, Buy Me a Coffee, etc.).
const DONATE_URL = "https://github.com/sponsors/Lonewolf127";

function externalOpen(url: string) {
  openUrl(url).catch((e) => console.error("open url failed", e));
}

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const addTab = useStore((s) => s.addTab);
  const addScratchFile = useStore((s) => s.addScratchFile);
  const importRequests = useStore((s) => s.importRequests);
  const exportRequests = useStore((s) => s.exportRequests);
  const historyEnabled = useStore((s) => s.settings.historyEnabled);
  const setHistoryEnabled = useStore((s) => s.setHistoryEnabled);

  const close = () => setOpenMenu(null);
  const toggle = (m: Menu) => setOpenMenu(openMenu === m ? null : m);
  const run = (fn: () => void) => {
    close();
    fn();
  };

  return (
    <div className="menubar">
      <span className="brand">◆ namtsop</span>

      <div className="menu">
        <button
          className={`menu-btn ${openMenu === "file" ? "active" : ""}`}
          onClick={() => toggle("file")}
        >
          File
        </button>
        {openMenu === "file" && (
          <div className="menu-drop">
            <button onClick={() => run(addTab)}>New Request</button>
            <button onClick={() => run(addScratchFile)}>New Scratch File</button>
            <div className="menu-sep" />
            <button onClick={() => run(importRequests)}>Import Requests…</button>
            <button onClick={() => run(exportRequests)}>Export Requests…</button>
          </div>
        )}
      </div>

      <div className="menu">
        <button
          className={`menu-btn ${openMenu === "help" ? "active" : ""}`}
          onClick={() => toggle("help")}
        >
          Help
        </button>
        {openMenu === "help" && (
          <div className="menu-drop">
            <button onClick={() => run(() => externalOpen(REPO_URL))}>
              Documentation
            </button>
            <button onClick={() => run(() => externalOpen(`${REPO_URL}/issues`))}>
              Report an issue
            </button>
            <button
              onClick={() => run(() => externalOpen(`${REPO_URL}/releases`))}
            >
              Releases
            </button>
          </div>
        )}
      </div>

      <button
        className="menu-btn donate"
        onClick={() => run(() => externalOpen(DONATE_URL))}
        title="Support development"
      >
        ♥ Donate
      </button>

      <div className="menu">
        <button
          className={`menu-btn ${openMenu === "settings" ? "active" : ""}`}
          onClick={() => toggle("settings")}
        >
          Settings
        </button>
        {openMenu === "settings" && (
          <div className="menu-drop wide">
            <label className="menu-check">
              <input
                type="checkbox"
                checked={historyEnabled}
                onChange={(e) => setHistoryEnabled(e.target.checked)}
              />
              Record request history
            </label>
          </div>
        )}
      </div>

      {openMenu && <div className="menu-backdrop" onClick={close} />}
    </div>
  );
}
