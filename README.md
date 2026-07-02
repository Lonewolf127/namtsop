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
- Response viewer: status, time, size, pretty-printed JSON, raw headers
- Syntax highlighting for JSON / XML / HTML

### Organizing requests (project structure)

The sidebar mirrors how a microservice is laid out:

```
UserService              ← project (a microservice)
├── AuthController        ← folder (a controller / group)
│   ├── POST  /login      ← request (an endpoint)
│   └── POST  /refresh
└── ProfileController
    ├── GET   /me
    └── PUT   /me
```

- Click **+** in the Projects header to create a project.
- Hover a project/folder and use **⊕** (new request), **▸+** (new folder),
  **✎** (rename), **×** (delete).
- Click a request to open it in a tab. Edits **auto-save** back to the project.
- Ad-hoc requests in a new tab can be filed into a project with **Save**.

Projects are stored as JSON, one file per project, under the OS app-data dir:

```
Windows:  %APPDATA%\com.bojesh127.namtsop\projects\
macOS:    ~/Library/Application Support/com.bojesh127.namtsop/projects/
```

### Coming next: environments

The project tree is designed to host **environments** (dev / stg / prod). Each
environment will carry its own variables (e.g. `{{base_url}}`, tokens) and the
same controllers/endpoints, so you can switch a whole project between
environments without duplicating requests. (Not yet implemented — see the
roadmap.)

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

- [ ] Environments (dev/stg/prod) with variable substitution `{{base_url}}`
- [ ] Request history
- [ ] Auth helpers (Bearer, Basic, API key)
- [ ] Import/export Postman collections
- [ ] Drag-and-drop reordering in the tree
- [ ] Code signing for the Windows installer
