# SIMQO Launcher

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
dist/SIMQO Launcher Setup 1.0.0.exe
```

The unpacked Windows application is generated at:

```text
dist/win-unpacked/SIMQO Launcher.exe
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
C:\Users\<WindowsUser>\AppData\Roaming\SIMQO Launcher\
```

Files used there:

- `session.enc`: encrypted Electron session; Unreal should not read it.
- `ue-session.json`: authentication handoff read by the packaged VR app.
- `settings.json`: remembered path of the installed VR executable.

Logging out terminates the VR process tree and removes both authentication
files. Running the installer again clears old launcher session and settings
data. Uninstalling also removes launcher application data.

## VR results hand-off

When a VR session ends, the VR application writes one results file for that
session. The launcher passes `-ResultsPath` to Unreal together with the session
file:

```text
-AuthSessionPath=C:\...\ue-session.json -ResultsPath=C:\...\results\results.json
```

**Unreal writes each session to its own file in the folder of `-ResultsPath`**,
named `results-<something unique>.json`, for example
`C:\...\results\results-20261019-094600.json`. Use only letters, digits, `.`,
`_` and `-` in the file name. Never reuse or overwrite another session's file.
Write it as `results-<name>.json.tmp` and rename it when complete; files ending
in `.tmp` are ignored. Write the recording before the results file.

Unreal does not have to send a `sessionId`. When a file has none, the launcher
derives one from the file's contents (`VR-` plus 32 hex characters) before
queueing it, so a retried upload, or the same file found again, is never stored
twice. A `sessionId` the VR app does send is used as it is.

Builds that still write the fixed `-ResultsPath` file name (`results.json`, or
`result.json`) keep working, but a second session that finishes before the launcher has picked up
the first would overwrite it, so new builds should use unique names.

By default the folder is `results\` in the launcher's user-data directory. Set
`VR_RESULTS_PATH` if the Unreal build writes to a fixed location instead (for
example next to the installed application); its folder is the one watched.

The launcher watches that folder, scans it every 5 seconds and on every start,
so files written while it was closed are picked up too. For each file it:

1. Gives it a sessionId if it has none, copies it into `results-outbox\` under
   that sessionId, then deletes the
   original. A file whose sessionId is already queued or sent is just deleted.
2. Uploads it to `POST /api/v1/vr/results` with the signed-in user's token. The
   server checks that `userId` matches the token, scores the attempt, and updates
   the analytics shown in the web app.
3. If `recording.path` is set, waits for the video file to finish writing, then
   uploads it directly to Supabase Storage through a signed upload URL and
   confirms the upload. If the video never appears, the session is marked
   "Unavailable" after about 10 minutes of retries.
4. Moves the entry to `results-sent\`. Entries the server rejects (invalid data,
   or results for a different user) go to `results-rejected\`, as do files
   that are not valid JSON or have no `userId`.

Failed uploads stay in the outbox and are retried every minute and after each
sign-in, including after the launcher or the computer restarts. Results are
only uploaded while the user they belong to is signed in, using that user's
token. Re-sending the same `sessionId` never creates a duplicate: the launcher
keeps one entry per sessionId and the server returns the stored session.

Regression tests for this hand-off run with `npm test`.

```json
{
  "schemaVersion": 2,
  "userId": "<userId from ue-session.json>",
  "startedAt": "2026-10-19T09:12:00Z",
  "completedAt": "2026-10-19T09:46:00Z",
  "rooms": [
    {
      "roomId": "gowning",
      "durationSeconds": 300,
      "steps": [
        { "index": 0, "points": 2, "maxPoints": 2, "critical": false, "error": null, "timestampSeconds": 20 },
        { "index": 1, "points": 3, "maxPoints": 3, "critical": false, "error": null, "timestampSeconds": 140 }
      ]
    },
    {
      "roomId": "granulation",
      "durationSeconds": 1740,
      "recordingOffsetSeconds": 300,
      "steps": [
        { "index": 0, "points": 10, "maxPoints": 10, "critical": false, "error": null, "timestampSeconds": 335 },
        { "index": 1, "points": 0, "maxPoints": 15, "critical": true, "error": "Binder added with the impeller stopped", "timestampSeconds": 710 }
      ],
      "competencies": [{ "name": "Equipment handling", "score": 80 }]
    }
  ],
  "recording": { "path": "recordings/20261019-094600.mp4", "durationSeconds": 2040 }
}
```

Every session is a run through 1 to 11 rooms, in any combination, each room
listed once. Each room in it also counts as an attempt at that room, so the web
app shows the session as a whole and every room on its own.

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | no | `2`. Files with a higher version are rejected. |
| `sessionId` | no | Added by the launcher when missing. If sent: unique per session, 8-128 characters of letters, digits, `.`, `_`, `:` or `-`. |
| `userId` | yes | Copy from `ue-session.json`. |
| `type` | no | Ignored. Older builds sent `"room"` or `"complete"`. |
| `completedAt` | yes | ISO 8601 UTC. Sessions are numbered by this time. |
| `startedAt` | no | ISO 8601 UTC. An empty engine date (before 2000, e.g. Unreal's `0001-01-01`) is treated as missing. |
| `rooms[].roomId` | yes | One of `gowning`, `wash`, `cleanstore`, `goods`, `dispensary`, `granulation`, `blending`, `tableting`, `blister`, `cartoning`, `water`. |
| `rooms[].durationSeconds` | yes | Time spent in the room. |
| `rooms[].steps[]` | yes* | `points` and `maxPoints` per step, any totals (up to 100000 each). `index` is the 0-based step in the room's process order. `error` is a short description, or `null`. An error on a `critical` step fails the attempt. `timestampSeconds` places a marker on the recording. |
| `rooms[].points`, `rooms[].maxPoints` | * | Only for a room sent without step points. |
| `rooms[].score` | * | Older builds only: a 0-100 score, used when there are no points. Ignored when points are sent. |
| `rooms[].criticalErrors` | no | Used only when `steps` is omitted. |
| `rooms[].recordingOffsetSeconds` | no | Where the room starts in the session recording. |
| `rooms[].competencies[]` | no | Optional skill breakdown shown on the session review. |
| `recording` | no | `null` when nothing was recorded. `path` is absolute or relative to the results file's folder. |

\* Each room needs step points, room points, or (older builds) a score.

Scoring (server side): the server works out every score from the points.

- Room score = points earned in the room ÷ the room's `maxPoints`, as a percentage.
- Session score = all points earned ÷ all `maxPoints` of the rooms played. Rooms
  not played don't count.
- A critical error means **Fail**; otherwise 80% or more is a **Pass**, 70-79% is
  **Review** (for a trainer to sign off) and below 70% is a **Fail**. This
  applies to each room and to the session.

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
