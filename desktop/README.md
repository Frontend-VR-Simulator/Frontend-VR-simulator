# VR Simulation Launcher

Electron desktop launcher for authenticating a user through the existing web
login and starting an already-installed packaged Unreal Engine VR application.

## What the launcher does

1. The user selects the installed VR application `.exe` once.
2. Sign in opens in the system browser.
3. After authentication, Electron receives a one-time desktop code.
4. Electron stores its private session using `safeStorage`.
5. A UE-compatible `ue-session.json` file is generated.
6. The installed VR application starts automatically.
7. The launcher remains open so the user can log out and stop the VR process.

The launcher prevents duplicate VR processes. On later starts, it restores the
saved session and automatically starts the remembered VR application.

## Requirements

- Node.js 20 or newer
- npm
- Ubuntu: Wine is required when building the Windows NSIS installer
- Windows: Wine is not required

Do not copy `node_modules`, `out`, or `dist` between systems. Install fresh
dependencies using `npm ci`.

## Build on Ubuntu

If Wine is not installed:

```bash
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install wine wine64 wine32:i386
wine --version
```

Build the launcher:

```bash
cd /path/to/Frontend-VR-simulator/desktop
npm ci
npm run typecheck
npm run build
```

## Build on Windows

Open PowerShell:

```powershell
cd "C:\path\to\Frontend-VR-simulator\desktop"
npm ci
npm run typecheck
npm run build
```

## Build output

The Windows installer is generated at:

```text
dist/VR Simulation Launcher Setup 1.0.0.exe
```

The unpacked Windows application is generated at:

```text
dist/win-unpacked/VR Simulation Launcher.exe
```

Send the `Setup.exe` file to the Windows user. The blockmap and YAML files are
not required for manual installation.

## Development

Start the backend and web frontend first. Then run:

```bash
cd desktop
npm ci
npm run dev
```

Default service URLs:

```text
Web login: http://localhost:5173
Backend:   http://localhost:8000/api/v1/user
```

Runtime configuration is documented in `.env.example`.

## Unreal Engine session handoff

The launcher passes the session file path to the packaged UE application:

```text
-AuthSessionPath=C:\absolute\path\to\ue-session.json
```

The JSON structure is:

```json
{
  "userId": "authenticated-user-id",
  "accessToken": "authenticated-access-token",
  "isLoggedIn": true
}
```

On Windows, launcher data is normally stored under:

```text
C:\Users\<WindowsUser>\AppData\Roaming\VR Simulation Launcher\
```

Files used there:

- `session.enc`: encrypted Electron session; Unreal should not read it.
- `ue-session.json`: authentication handoff read by the packaged VR app.
- `settings.json`: remembered path of the installed VR executable.

Logging out terminates the VR process tree and removes both authentication
files. Running the installer again clears old launcher session and settings
data. Uninstalling also removes launcher application data.

## Code signing

An unsigned installer displays `Unknown publisher`. For a trusted production
build, obtain a Windows Authenticode code-signing certificate in `.pfx` or
`.p12` format and keep it outside the repository.

On Ubuntu:

```bash
export WIN_CSC_LINK="/absolute/path/company-code-signing.pfx"
read -s WIN_CSC_KEY_PASSWORD
export WIN_CSC_KEY_PASSWORD
npm run build
unset WIN_CSC_LINK
unset WIN_CSC_KEY_PASSWORD
```

Never commit the certificate, its password, `.env` files, access tokens, or
generated session files.

## Rebuild from GitHub

```bash
git clone git@github.com:Frontend-VR-Simulator/Frontend-VR-simulator.git
cd Frontend-VR-simulator/desktop
npm ci
npm run typecheck
npm run build
```
