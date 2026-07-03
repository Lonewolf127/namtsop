# namtsop — agent context

Fast, lightweight Postman-style HTTP client for Windows. **Tauri v2 (Rust) + React 19 + TypeScript + Vite**. Read this file first; it maps the codebase so you can work without reading every file.

## Commands
- `pnpm install` — deps (needs Node 20+, pnpm, Rust via rustup: `source "$HOME/.cargo/env"`).
- `pnpm tauri dev` — run the desktop app (hot reload).
- `pnpm dev` — Vite only (frontend at http://localhost:1420; no Rust/Tauri).
- `npx tsc --noEmit` — typecheck (does NOT catch runtime issues).
- `pnpm build` — production frontend build (`tsc && vite build`).
- `cd src-tauri && cargo build` — compile the Rust backend.

## Architecture
Frontend calls Rust over Tauri IPC. **All HTTP happens in Rust** (native `reqwest`, pooled client) — never in JS. The frontend is UI + state only.

```
src/
  App.tsx              App shell: MenuBar + Sidebar + tab area. Renders UrlBar+Request/ResponsePanel for request tabs, ScratchEditor for scratch tabs.
  store.ts             Zustand store — THE brain: tabs, projects tree, environments, variables, history cache, scratch, settings, import/export, drag&drop. Also tree helpers (mapNode/removeNode/insertChild/findNode/cloneNodes) + debounced persistence.
  types.ts             All shared types. Tab = RequestTab | ScratchTab (discriminated by `kind`).
  lib/
    api.ts             invoke() wrappers for every Rust command.
    vars.ts            {{variable}} substitution (buildVarMap, substitute).
    format.ts          JSON (JSON.parse) + XML (DOMParser+reindent) beautifiers.
  components/
    MenuBar.tsx        Top bar: File/Help/Settings + far-right coffee button.
    Sidebar.tsx        Project tree (Project → Environment → folders/requests), drag&drop, collapse-to-ribbon, env/global variable editors.
    RequestPanel.tsx   Params/Headers/Body/History sub-tabs for a request.
    ResponsePanel.tsx  Status/time/size, Body(Pretty/Raw)/Headers.
    HistoryPanel.tsx   Per-request send history (payload + response, restore).
    KeyValueEditor.tsx Reusable key/value/notes rows (params, headers, variables).
    EnvVarsModal.tsx   Modal to edit env vars or project globals.
    ScratchEditor.tsx  Free-form buffer editor with JSON/XML Format.
    CodeEditor.tsx     CodeMirror 6 wrapper (json/xml/html).
src-tauri/src/
  lib.rs               Tauri builder: plugins (opener, dialog), managed HttpState, invoke_handler registry.
  http.rs              send_request command; two pooled reqwest clients (follow/no-redirect).
  storage.rs           Projects/settings/history/scratch persistence + generic read_text_file/write_text_file. All under the OS app-data dir.
```

## Data model (see types.ts)
`Project` → `environments: Environment[]` (each an ISOLATED tree) + `globals: KeyValue[]`. `Environment` → `nodes: TreeNode[]` + `variables: KeyValue[]`. `TreeNode` = folder (children) | request (RequestData). Persisted one-JSON-per-project via Rust; schema `version: 2` (v1→v2 migration in `normalizeProject`). Variable resolution at send time: `{...projectGlobals, ...envVars}` (env overrides). History is per-request in its own file, loaded lazily. Scratch files persist to `scratch.json`.

## Conventions & gotchas (IMPORTANT)
- **Zustand selectors must return STABLE references** (a state object via `.find`, or a primitive) — NEVER a freshly-built object/array. An unstable snapshot → infinite render loop ("Maximum update depth exceeded") → blank screen. This caused a shipped crash; see UrlBar/EnvVarsModal for the correct pattern.
- **Tabs are a union.** Guard `t.kind === "request"` before reading `.nodeId/.projectId/.envId/.method/.url` etc.
- **Verify UI at runtime** — tsc/build do NOT catch render loops. Drive the Vite dev server in a browser with a mocked `window.__TAURI_INTERNALS__.invoke` (return values per command; dialog calls are `plugin:dialog|save/open`). `.claude/launch.json` defines the `vite` preview server.
- Keep it lightweight: prefer native Rust work, avoid heavy deps (no Monaco — CodeMirror instead).
- New Rust command → add `#[tauri::command]` in the right module + register in `lib.rs` invoke_handler + wrapper in `lib/api.ts`.

## Release process
Public repo `Lonewolf127/namtsop`. Windows installers built by `.github/workflows/release.yml` (tauri-action, windows-latest) on `v*` tag push → attached to a GitHub Release.
- Bump version in **all three**: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, then `cd src-tauri && cargo update -p namtsop --precise <ver>`.
- Tag **patch** bumps (v0.1.x) — user preference.
- CI **must** use pnpm 10 (pnpm 9 rejects `pnpm-workspace.yaml` without `packages:`).
- Commits must use the noreply email `58829456+Lonewolf127@users.noreply.github.com` (GitHub blocks the private gmail).
- Current released line: v0.1.x.

## Env quirks
- esbuild's build script is allowlisted via `onlyBuiltDependencies` in `pnpm-workspace.yaml`; CI also runs `pnpm rebuild esbuild`.
- Developed on macOS; Windows-only behavior (e.g. window maximize) can't be verified locally — flag it for the user to test.
