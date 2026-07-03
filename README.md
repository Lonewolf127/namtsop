# namtsop

A fast, lightweight HTTP/HTTPS client for Windows — a Postman-style API tool
built for low memory use and quick launch. Organize your requests into
**projects** (one per microservice), group them into **folders** (controllers),
and store each **endpoint** as a saved request.

---

## Install on Windows

You do **not** need Node, Rust, or any dev tools to run the app — just download
the installer.

1. Go to the [**Releases**](../../releases) page.
2. Download the latest installer:
   - `namtsop_x.y.z_x64-setup.exe` — recommended (NSIS installer), or
   - `namtsop_x.y.z_x64_en-US.msi` — MSI (good for managed/enterprise machines).
3. Run it. If Windows SmartScreen warns about an unknown publisher (the build is
   unsigned), click **More info → Run anyway**.
4. Launch **namtsop** from the Start menu.

> **WebView2 runtime:** required, and already preinstalled on Windows 10/11. On
> older/stripped images the installer will prompt to fetch it automatically.

No installers on the Releases page yet? See
[Building & releasing](#building--releasing) below — pushing a version tag
produces them automatically.

---

## Features

- **Projects → Folders → Requests** tree in the sidebar for organizing APIs
  (e.g. a microservice with many controllers and endpoints)
- Saved requests **auto-persist** to disk; reopen the app and they're still there
- Multiple request **tabs**
- Methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Query params & headers editors (per-row enable/disable)
- Request body: JSON / Text / XML / Form (auto `Content-Type`)
- Response viewer: status, time, size, raw headers, **Pretty/Raw** toggle
- **Format / beautify** JSON & XML in both the response and the request body
- Collapsible **Projects** sidebar (fold to a ribbon to maximize the request area)
- Syntax highlighting for JSON / XML / HTML
- Per-request **history** — payload + response for each send, with restore
- Default environments: **local**, dev, stg, prod

### Organizing requests (project structure)

The sidebar mirrors how a microservice is laid out, with a separate isolated
tree per **environment** (dev / stg / prod):

```
UserService                ← project (a microservice)
├── ⬢ dev  ●  (active)     ← environment (own isolated tree)
│   └── AuthController      ← folder (a controller / group)
│       ├── POST  /login    ← request (an endpoint)
│       └── POST  /refresh
├── ⬢ stg
│   └── AuthController
│       └── POST  /login    ← same endpoint, different base URL
└── ⬢ prod
    └── AuthController
        └── POST  /login
```

- Click **+** in the Projects header to create a project. It comes with **dev,
  stg and prod** environments out of the box.
- Hover a **project** → **⬢+** add environment, **✎** rename, **×** delete.
- Hover an **environment** → **⊕** new request, **▸+** new folder, **◉** set
  active, **⧉** duplicate (clones the whole tree — build `dev` once, copy it to
  `stg`/`prod` and just change the URLs), **✎** rename, **×** delete.
- Hover a **folder/request** → the same request/folder/rename/delete actions.
- Click a request to open it in a tab. Edits **auto-save** back to that
  environment. The URL bar shows a `Saved · dev` pill so you always know which
  environment you're editing.
- **Drag & drop** a request or folder into another folder, onto an environment
  (moves it to that env's root), or across environments in the same project.
- Ad-hoc requests in a new tab can be filed into a project's active environment
  with **Save**.

#### Variables (`{{base_url}}`)

Each environment carries its own variables, so the same request resolves
differently per environment:

- Hover an environment → **`{}`** to open its variables editor. New
  environments come with a `base_url` variable ready to fill in.
- Reference a variable anywhere in a request — URL, header keys/values, query
  params, or body — as `{{base_url}}`. It's resolved at send time against the
  request's own environment.
- When a URL contains a variable, the URL bar shows a live **`→` preview** of
  the resolved address.

```
dev  → base_url = http://localhost:8080
prod → base_url = https://api.company.com

Request URL:  {{base_url}}/users/42
  in dev  →   http://localhost:8080/users/42
  in prod →   https://api.company.com/users/42
```

Undefined variables are left as-is (e.g. `{{missing}}`) so mistakes are visible.

### Request history

Every saved request keeps a **History** tab showing past sends — the payload
that went out and the response that came back:

- Open a saved request → **History** sub-tab. Pick an entry to see its
  **Response** (status, time, size, body) or **Payload** (method, URL, headers,
  body).
- **↩ Restore** loads a past payload back into the request.
- History is stored **per request** in a separate file and loaded **lazily**
  (never at app launch), so it has no effect on startup time. Only the last 50
  sends per request are kept.
- Toggle **Record request history** in the sidebar footer to turn recording off
  entirely if you'd rather keep things minimal.

Projects are stored as JSON, one file per project, under the OS app-data dir:

```
Windows:  %APPDATA%\com.bojesh127.namtsop\projects\
macOS:    ~/Library/Application Support/com.bojesh127.namtsop/projects/
```

---

## Why it's light & fast

| Concern      | Choice                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| Desktop shell| **Tauri v2** — OS WebView2, not bundled Chromium (installer is ~MBs)    |
| Networking   | **Rust `reqwest`** on a shared, pooled client — off the UI thread      |
| TLS          | **rustls** — no system OpenSSL, self-contained, clean Windows builds   |
| Frontend     | React + **Zustand** + **CodeMirror** (deliberately not Monaco)         |
| Binary       | release profile: LTO + `strip` + `panic=abort` + `opt-level=s`         |

---

## Architecture

```
src/                     React frontend (UI only)
  components/            Sidebar (project tree), request/response panels, editors
  store.ts               Zustand store: tabs + project tree + persistence
  lib/api.ts             Tauri command bridge
src-tauri/src/
  http.rs                Native reqwest HTTP engine (send_request command)
  storage.rs             Project persistence (list/save/delete_project)
  lib.rs                 App wiring + shared client state
```

The frontend calls Rust commands over Tauri IPC: `send_request` performs HTTP,
and the `*_project` commands read/write project JSON files.

---

## Develop (any OS)

Prereqs: [Rust](https://rustup.rs), Node 20+, [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm tauri dev      # native app with hot reload
```

## Building & releasing

Tauri must be built **on Windows**. This repo does it in CI so you don't need a
Windows machine:

```bash
# Cut a release — CI builds the installers and attaches them to a GitHub Release
git tag v0.1.0
git push origin v0.1.0
```

See [`.github/workflows/release.yml`](.github/workflows/release.yml). You can
also run that workflow manually from the **Actions** tab to build installers as
a downloadable artifact without publishing a release.

To build locally on a Windows machine instead:

```bash
pnpm install
pnpm tauri build
# output: src-tauri/target/release/bundle/{msi,nsis}/
```

Local Windows builds require the WebView2 runtime and the MSVC C++ build tools.

---

## Roadmap

- [x] Environments (dev/stg/prod) — isolated request tree per environment
- [x] Per-environment variables with `{{base_url}}` substitution
- [x] Project-level (global) variables inherited by all environments (env overrides)
- [x] Per-request history (payload + response, restore, on/off toggle)
- [ ] Custom environments & configurable per-env URL parts
- [ ] Auth helpers (Bearer, Basic, API key)
- [ ] Import/export Postman collections
- [ ] Drag-and-drop reordering in the tree
- [ ] Code signing for the Windows installer
