# Pharma VR LMS — Architecture Audit & Neon → Supabase Migration Plan

Audit date: 19 Oct 2026. Read-only audit: no application code changed, no migrations run, nothing committed or deployed during it.

**Labels**
- **[V] VERIFIED**: read in the code or git history, or observed by running a check.
- **[I] INFERRED**: a strong conclusion from evidence that wasn't directly observed.
- **[NV] NOT VERIFIED**: needs access I don't have (Vercel, Neon, a real Unreal build).

## 0. Corrections to the brief and prior actions

**Corrections to the brief's assumptions**
- **No tests exist in the repo.** [V] There are no `*.test.*` or `*.spec.*` files and no test runner; every `package.json` has the placeholder `"test": "echo \"Error: no test specified\""`. No in-memory database or storage stand-in exists in the repository. Whatever earlier testing the brief refers to left no code behind, so nothing below relies on it.
- **The LMS implementation is uncommitted.** [V] `git status` on `main` shows 35 changed paths: 21 modified or deleted files, plus untracked new files and directories (`vrController.js`, `vrRoutes.js`, `rooms.js`, `audit.js`, `results.ts`, and `frontend/src/{components,content,design,lib,pages}/`). The local `main` is at `91debca` (4 Sep 2026).
- **Production code is on a different branch.** [V] `origin/postgres-neon` (`bb6fdaa`, 11 Sep 2026) is 2 commits ahead of `main`'s base:
  - `7188ef4` "migrate database from Supabase to PostgreSQL"
  - `bb6fdaa` "fix: allow Vercel deployment origins in CORS"

  The new LMS was built on the older Supabase-SDK code and has **never been merged with the Neon branch**.

**Actions taken earlier in this conversation, before this brief's constraints were given**
1. Ran `npm run db:setup` against the **dev** Supabase project referenced in `backend/.env`. It succeeded and upgraded that project's schema.
2. Inserted 4 users there (admin/head/trainer/trainee @linchpinglobal.net) and later changed their passwords.
3. Removed the on-screen keyboard from the login page:
   - edited `frontend/src/pages/Login.jsx` and `frontend/src/design/app.css`;
   - deleted `frontend/src/auth/virtual-keyboard.jsx` and the now-empty `auth/` folder.

   The deleted file's working-tree contents are preserved in this conversation and can be restored on request.
4. Wrote `system.md`. Parts of it assume Supabase in production and need updating after this audit.
5. Started a local backend (`node server.js`) as a background process for the login test.

Nothing touched Neon or any production system.

---

## 1. Actual Stack and Deployment

| Area | Finding | Evidence | Label |
| --- | --- | --- | --- |
| Repo | Git repo at `Frontend-VR-simulator/`; remote `github.com:Frontend-VR-Simulator/Frontend-VR-simulator`; branches `main`, `origin/postgres-neon` | `git remote -v`, `git branch -a` | V |
| Frontend | React 19, Vite 8, Tailwind 4, hash router; JWT kept in `localStorage`/`sessionStorage` | `frontend/package.json`; `frontend/src/App.jsx` `loadAuth`/`storeAuth`; `lib/router.js` | V |
| Backend | Express 5 (ESM), bcrypt, jsonwebtoken, nodemailer; exports `app` for Vercel, listens only when `!process.env.VERCEL` | `backend/server.js` | V |
| DB access, `main` | **Supabase JS SDK only** (PostgREST over HTTPS with the service-role key). `pg` is used only by the migration script | `backend/src/config/supabaseConfig.js`; all controllers; `src/supabase/scripts/setupDatabase.js` | V |
| DB access, `postgres-neon` | **`pg` Pool only** (`DATABASE_URL`); `supabaseConfig.js` deleted; every query rewritten as SQL. Same endpoints, same messages: a straight port | `git show origin/postgres-neon:backend/src/config/postgreesConfig.js`; `git diff main origin/postgres-neon --stat` (11 files) | V |
| Auth | **Custom auth, not Supabase Auth.** bcrypt hash in `public.users.password`; HS256 JWT `{userId, role}`, `expiresIn: "2h"` | `loginController.js` `login`; `middleware/auth.js` `requireAuth` | V |
| Storage | Supabase Storage, private bucket `session-recordings`; signed upload and playback URLs | `vrController.js` `createRecordingUpload`, `getRecordingUrl`; migration `INSERT INTO storage.buckets` | V |
| Storage in prod | **None.** The Neon branch has no Supabase client, and the old code has no recordings | Neon branch tree | V |
| Hosting | Two configs: root `vercel.json` (multi-service: `frontend` = vite, `backend` = `server.js`, `/api/*` → backend) and `backend/vercel.json` (legacy `api/index.js`, `maxDuration: 30`). Which one Vercel uses depends on the project's Root Directory setting | files listed | V (files) / NV (which is live) |
| Prod on Vercel + Neon | The Neon branch's CORS commit reads `VERCEL_URL`, `VERCEL_BRANCH_URL` and `VERCEL_PROJECT_PRODUCTION_URL`; its `.gitignore` adds `.vercel` and `.env.neon`; its `.env.example` says "neon" | `git show origin/postgres-neon:backend/server.js` | I |
| Deployed branch | Unknown; no `.vercel/` folder and no Vercel access | n/a | NV |
| Electron launcher | electron-vite + electron-builder (NSIS, Windows), sandboxed renderer, `contextIsolation`, `safeStorage` | `desktop/src/main/index.ts`, `preload/index.ts`, `electron.vite.config.ts` | V |
| Unreal | **Not in the repo.** The launcher spawns the chosen `.exe` with `-AuthSessionPath=<ue-session.json> -ResultsPath=<results.json>` | `index.ts` `launchVrApp` | V (launcher side) / NV (Unreal side) |
| Static checks | Desktop `npm run typecheck` passes, frontend `vite build` passes, frontend `eslint src` is clean, `node --check` passes on all backend files | run during this audit | V |

**What is implemented, on the uncommitted `main` working tree** [V]:
- **Backend:** `/vr/results` ingestion with validation, scoring and attempt numbering; recording upload-url, complete and unavailable endpoints; signed playback; feedback; programs; audit log; integration health; role-scoped `/vr/workspace` feed.
- **Frontend:** four role workspaces and the session review page.
- **Launcher:** browser sign-in hand-off, VR launch and stop, a durable results outbox with retries, recording upload.

**Incomplete:**
- Unreal side (absent).
- Production URL configuration for the launcher.
- Merge with the Neon branch's CORS change.
- Tests.
- Password change and reset.
- Large-file uploads.

---

## 2. Local vs Production Comparison

| | Local (`main` working tree) | Production (`postgres-neon`) |
| --- | --- | --- |
| Backend env vars | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` (Supabase direct host, used **only** by `db:setup`), `PORT`, `JWT_SECRET_KEY`, `FRONTEND_URL`, `SMTP_*`, `ADMIN_*`, `RECORDING_BUCKET`, `RECORDING_STORAGE_QUOTA_GB` [V] | `DATABASE_URL` (Neon, used at **runtime**), `PORT`, `JWT_SECRET_KEY`, `FRONTEND_URL`, `SMTP_*`, `ADMIN_*` [V from `.env.example`]; real Vercel values [NV] |
| DB driver | `@supabase/supabase-js` | `pg` Pool |
| Storage | Supabase Storage | none |
| CORS | `localhost:5173` + `FRONTEND_URL` | also adds the three `VERCEL_*` URLs automatically |
| Frontend env | **No `frontend/.env`**, so `VITE_API_URL` falls back to `http://localhost:8000/api/v1` (`config/api.js`) [V] | Set in Vercel [NV]; same-origin `/api/v1` would fit the root `vercel.json` |
| Launcher env | `WEB_URL`, `API_URL`, `VR_API_URL`, `VR_SESSION_PATH`, `VR_RESULTS_PATH`, all read from `process.env` **at runtime** with localhost defaults [V] | No production build configured. An installed launcher on a trainee PC would call `localhost` [I] |

---

## 3. Database Schema and Data Inventory

### Production schema (Neon) [I]
The Neon branch never changed `userTableCreation.sql`, so production should match the `main` HEAD version:
- `users`: id, name, email UNIQUE, password, role CHECK of the 4 roles, employee_id UNIQUE, batch, trainer_id → users, created_at
- `invitations`
- `training_sessions`: **only** id, trainee_id, trainer_id, score, duration_minutes, completed_at
- `desktop_auth_codes`
- RLS enabled with no policies

### Added by the new implementation (uncommitted migration diff) [V]
- `training_sessions` gets **15 columns**: `external_id` UNIQUE, `session_type`, `room_id`, `attempt`, `result`, `critical_errors`, `rooms` JSONB, `started_at`, `reviewed_at`, `reviewed_by` → users, `recording_status`, `recording_path`, `recording_bytes`, `recording_duration_seconds`, `raw_payload` JSONB.
- It also gets 3 CHECK constraints and 2 indexes.
- New tables: `session_feedback` (FK → training_sessions CASCADE), `programs`, `audit_events` (+ index); RLS enabled on all three.
- `INSERT INTO storage.buckets (...) 'session-recordings', public=false`. This is **Supabase-only**. On Neon the `storage` schema doesn't exist and the script fails.

### Does `npm run db:setup` preserve existing data?
**Mostly yes, with caveats.**
- [V] It is additive: `CREATE … IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`. Nothing is dropped except the role CHECK constraints, which are re-created at once.
- [I] The whole file is sent as one multi-statement query, so Postgres runs it as one implicit transaction. Any error rolls everything back, which makes it fail-safe.

Caveats:
- `UPDATE users SET role = CASE role WHEN 'employee' THEN 'trainee' ELSE role END` rewrites **every** user row (values unchanged except `employee`).
- If any production row has a role outside the 4, re-adding `users_role_check` fails and the run aborts.
- `ALTER TABLE … ADD CONSTRAINT` takes a brief exclusive lock.
- **Legacy sessions are reclassified.** Existing `training_sessions` rows take the new defaults: `result='Review'`, `session_type='room'`, `room_id=NULL`. In the new UI every legacy session would show as **"pending review"** with the title "VR session" (`frontend/src/lib/model.js` `isPendingReview`, `normalizeSession`). That calls for a backfill decision.
- There is no migration versioning, only one re-runnable file. Grants and permissions are not touched.

### Data
- **Dev Supabase** [V, read-only count]:
  - `users` 5: the 4 new accounts, plus a legacy `trainee` created on **2026-09-02** with no employee_id, batch or trainer.
  - `audit_events` 7. All other tables are 0.
  - Bucket is private, with no bucket-level file-size limit, so the project-wide limit applies.
  - [I] The 2 Sep row predates the Neon switch (11 Sep), so this dev project is probably the pre-Neon database.
- **Production Neon:** **[NV]**, no credentials. Treat it as **non-empty**:
  - the first admin was created via `createAdmin.js`;
  - invitations work in production code;
  - the old UI read `training_sessions` via `/user/dashboard`.

### Other schema concerns
- `attempt` has no uniqueness, so concurrent ingests for the same trainee could produce duplicate numbers [I].
- `programs.batch` is free text with no FK.

---

## 4. Authentication and Session Architecture

**Login.** [V] `login` → `bcrypt.compare` → `jwt.sign({userId, role}, JWT_SECRET_KEY, 2h)`.
- `requireAuth` trusts the role inside the token without a DB lookup, so a role change or deletion takes effect only when the token expires (≤ 2 h).
- **No refresh token.** The frontend logs out on any 401 (`lib/api.js`).

**Role mapping.** [V] trainee→learner, trainer→trainer, head→manager ("Training Manager"), admin→admin (`frontend/src/lib/model.js` `ROLE_VIEW`).

**Invitations.** [V] `createInvitation`: admin can invite admin/head; head can invite trainer/trainee, and a trainee needs a batch and trainer.
- The token is 32 random bytes, stored **in plain text**, valid 72 h, and returned in the API response for copy-link.
- `acceptInvitation` inserts the user, then marks the invitation accepted. The two writes are not in one transaction.

**Desktop hand-off.** [V] The launcher listens on `127.0.0.1:<random>` with a 32-byte `state` and a 120 s timeout.
- The browser calls `POST /user/desktop-code`, which stores `sha256(code)` **and the raw JWT** in `desktop_auth_codes` with a 60 s TTL.
- The launcher exchanges the code through `POST /user/desktop-token`, an atomic delete-returning call, so each code works once.
- `Login.jsx` `readDesktopRequest` validates the redirect URI to be loopback `/callback` only.
- **Rows for codes that are never exchanged are never purged**, so valid JWTs (≤ 2 h) sit in that table [V].

**Data passed to Unreal.** [V] `ue-session.json` = `{userId, accessToken, isLoggedIn}`, plain text in the launcher's userData folder.
- `chmod 600` has no effect on Windows; the file is protected only by the Windows user profile.
- Unreal needs only `userId`, so the token in this file is unnecessary exposure.

**Different learner on the same workstation.** [V]
- Logout (`stopVrApp` + `clearSession`) kills the VR process tree and deletes both session files.
- Queued results for learner A stay in the outbox and upload **only when A signs in on that PC again** (`results.ts` `processEntry` skips other users).
- The server independently rejects a results file whose `userId` doesn't match the token: `ingestResults` returns 403.
- [I] If the launcher crashes while VR runs, the relaunched launcher loses the process handle and could start a second VR instance.

**Authorization.** [V]
- Recording upload endpoints are owner-only (`ownedSession`: `trainee_id` = token user).
- Playback uses `canViewSession`: admin/head see all, a trainer sees assigned trainees, a trainee sees their own. Playback links are signed for 1 h.
- Feedback marked `private` is hidden from trainees.
- RLS is on with no policies, so the publishable key handed to the launcher cannot read any table.
- **Gap:** `POST /user/training-sessions` (`dashboardController.js` `createTrainingSession`) lets a trainee insert **any score for themselves**. Neither the new UI nor the old one calls it [V].

**Does Neon → Supabase need an auth migration? No: it's a database move only.** [V]
- Identities live in `public.users` (UUID ids, bcrypt hashes), not in Supabase Auth.
- Copying the rows preserves ids, passwords and trainer links.
- Keeping the same `JWT_SECRET_KEY` keeps live tokens valid across cutover.
- Supabase Auth should **not** be adopted now; it would be a rebuild with no current need.

---

## 5. VR Integration Audit

Path traced: `Login.jsx` → `/user/desktop-code` → launcher `startLogin`/`exchangeCode` → `persistSession` → `launchVrApp` → Unreal (absent) → `results.json` → `results.ts` `start`/`intakeResultsFile` → outbox → `processEntry` → `POST /vr/results` `ingestResults` → `training_sessions` → recording `uploadRecording` → `GET /vr/workspace` → `buildModel` → UI.

| Check | Status | Notes |
| --- | --- | --- |
| Launch parameters vs contract | V (launcher) / NV (Unreal) | Match `desktop/README.md` exactly. No Unreal build to confirm |
| Session id / attempts | V | `sessionId` regex `^[A-Za-z0-9._:-]{8,128}$`; attempt = count of earlier `completed_at` + 1; later attempts renumbered |
| Duplicates / conflicts | V | Same `external_id` + same user → 200 `duplicate`; other user → 409; unique-race (23505) handled |
| Validation and scoring | **V, ran locally** | `normalizeResults` exercised with 10 cases (critical → Fail, 85 → Pass, 75 → Review, complete run 1/11 → 9.09 Fail; bad room, schema, room-count, date and type all rejected). A pure function: no DB, no network |
| Partial JSON writes | V | 750 ms settle + 10 parse retries 1 s apart; still invalid → kept in `results-rejected/invalid-<ts>.json`, never retried |
| Single hand-off file | V | **Risk:** if Unreal writes a second `results.json` before the launcher picks up the first, or two sessions finish while the launcher is closed, the first is overwritten and lost |
| Watcher recovery | V | `fs.watch` + 5 s existence poll; intake on startup |
| Persistent queue | V | `results-outbox/` on disk; retry every 60 s and on sign-in; `results-sent/`, `results-rejected/` |
| Offline / expired token | V | Entries persist. On 401 the launcher clears the session (VR keeps running) and waits for sign-in |
| Large recordings | V (code) / NV (limits) | One streamed `PUT` to a Supabase signed upload URL; no resumable or TUS upload. Supabase free plan caps files at 50 MB [I]. Vercel is not in the byte path, which is good |
| Late recordings | V | Up to 10 checks (~10 min of retries), then `recording/unavailable` |
| Transactions | V | `ingestResults` = insert + N separate attempt updates, **no transaction** (the SDK has none). A mid-loop failure leaves attempt numbers inconsistent |
| Analytics recalculation | V | Nothing stored: computed client-side from the feed each refresh. Changing `PASS_MARK` doesn't re-grade stored `result` |
| UI refresh, 4 roles | V | One `/vr/workspace` feed, polled every 30 s + on focus (`App.jsx` `REFRESH_MS`) |
| Mocked | — | Nothing in the repo is mocked; there are simply **no tests**. The real end-to-end path (Unreal → launcher → server → storage → UI) **has never been run** [NV] |

---

## 6. Neon → Supabase Migration Feasibility

1. **Compatible?** Yes. `main` already targets Supabase; the schema is plain Postgres plus one `storage.buckets` insert.
2. **Backend refactor?** **No.** Deploy `main`'s SDK code; the Neon branch's `pg` port is discarded. Port only its CORS commit (`bb6fdaa`) [V: the port added no features].
3. **Supabase Auth?** Keep custom auth unchanged.
4. **Storage in both environments?** Yes. Use a separate Supabase project per environment, each with its own private bucket.
5. **What to migrate:**
   - Rows: `users`, `invitations`, `training_sessions`.
   - Skip `desktop_auth_codes`; it's ephemeral.
   - Schema, indexes, FKs, constraints and RLS come from `db:setup` run on the target, not from a dump. No custom policies exist.
6. **Do Neon user ids stay valid?** Yes, as long as UUIDs are copied verbatim [I: standard `uuid` columns].
7. **Lossless?** Yes for data. Legacy sessions need a **backfill decision**, or they appear as pending review.
8. **Tooling:**
   - `pg_dump --data-only --column-inserts -t users -t invitations -t training_sessions` from Neon, then `psql` into Supabase after `db:setup`.
   - `--column-inserts` lets the new columns take their defaults.
   - `users.trainer_id` references `users`, and `--disable-triggers` needs superuser, which Supabase doesn't grant. So load users with `trainer_id` NULL, then `UPDATE` it.
   - `pg_dump` must be at least the Neon server version.
9. **Env / Vercel:**
   - Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RECORDING_BUCKET`, `RECORDING_STORAGE_QUOTA_GB` (Production scope only).
   - Keep `JWT_SECRET_KEY`.
   - `DATABASE_URL` becomes Supabase's **session pooler** URL, used only for migrations from a laptop or CI; the direct host is IPv6-only on Supabase [I].
   - Keep the Neon `DATABASE_URL` stored somewhere separate for rollback.
10. **Backup, freeze, cutover, rollback:** see section 8.

**Risks**
- The two branches have diverged; merging is required.
- Legacy-session semantics.
- No rehearsal has been done.
- Admin `/vr/workspace` returns **all sessions with `rooms` JSONB** in one response. Vercel functions cap responses at about 4.5 MB and the timeout is 30 s, so this fails beyond a few thousand complete sessions [I].

---

## 7. Recommended Final Architecture

One codebase; environments differ by configuration only.

| | Local | Production |
| --- | --- | --- |
| Web | `vite` on 5173, `VITE_API_URL=http://localhost:8000/api/v1` | Vercel `frontend` service, same-origin `/api/v1` |
| API | `node server.js` on 8000 | Vercel `backend` service (root `vercel.json`); remove the unused `backend/vercel.json` once the live config is confirmed |
| Data + files | Supabase **dev** project (DB + private bucket) | Supabase **prod** project (DB + private bucket), paid plan for video sizes |
| Auth | Custom JWT, dev secret | Custom JWT, the **existing** prod secret |
| Launcher | `npm run dev` with localhost URLs | Installer built with production URLs **inlined at build time**, code-signed |
| Unreal | Same build, reads `-AuthSessionPath` / `-ResultsPath` | Same |

**Minimal changes required (for approval)**
1. Commit the LMS work on a feature branch. Bring in `bb6fdaa`'s CORS logic. Leave `postgres-neon` intact for rollback.
2. **Launcher:** read URLs from `import.meta.env.MAIN_VITE_WEB_URL` / `MAIN_VITE_API_URL`, keeping the `process.env` override for development, so production builds aren't stuck on localhost.
3. Remove `POST /user/training-sessions`.
4. **Migration:**
   - make the `storage.buckets` insert conditional on the `storage` schema existing;
   - add the legacy-session backfill as a separate, explicit script;
   - add a purge of expired `desktop_auth_codes`.
5. Basic login rate limiting (in-memory per instance is weak on serverless; a small table-based counter fits the stack).
6. Before scale: paginate or summarize the admin `/vr/workspace` feed.
7. Phase 2: resumable uploads for recordings.

---

## 8. Migration and Deployment Runbook

1. **Branch.** Commit the working tree to `feature/lms` and merge in the CORS change. Run local checks. Don't touch `postgres-neon`.
2. **Inventory production read-only.** Row counts per table, `SELECT DISTINCT role`, Postgres version, and a check for orphan `trainer_id`s.
3. **Rehearse on copies.**
   - Create a Neon **branch** (copy-on-write; no load on production) and a Supabase **staging** project.
   - Run `db:setup` on staging, load the data (step 6), apply the backfill, and validate (step 7).
   - Deploy `feature/lms` to a Vercel **preview** pointed at staging, then smoke-test all four roles and one launcher sign-in.
4. **Create the Supabase prod project** on a paid plan. Set the storage file-size limit. Run `db:setup` on the empty project.
5. **Freeze writes.** Announce a window. Set Neon read-only: `ALTER DATABASE … SET default_transaction_read_only = on` plus a reconnect, or a maintenance deploy.
6. **Backup and copy.**
   - Take a full `pg_dump -Fc` of Neon and keep it.
   - Take the data-only dump of the 3 tables.
   - Load into Supabase: users without `trainer_id`, then the `trainer_id` update, then invitations, then training_sessions.
   - Run the legacy backfill.
7. **Validate.**
   - Row counts match.
   - The MD5 of `string_agg(id||email||password, '' ORDER BY id)` matches between the two databases.
   - FK checks pass.
   - A login works with an existing production account.
8. **Cut over.** Set Supabase env vars in Vercel Production, deploy `feature/lms` to production, and smoke-test.
9. **Rollback** (if needed within the window):
   - redeploy the previous Vercel production deployment (the Neon code) and lift the Neon read-only flag;
   - Neon is untouched, so there is no data loss;
   - writes made to Supabase after cutover would have to be copied back, which is why the window is kept short.
10. Keep Neon read-only for an agreed period, then decommission it.

---

## 9. Required Tests

**Local (safe now)**
- Unit tests for `normalizeResults` and `assessResult`.
- `results.ts` against a temp directory and a local HTTP stub, covering: partial write, duplicate, a different user's file, 401, recording arriving late.
- Role-scope tests on `getWorkspace` and `canViewSession`.

**Staging**
- Full migration rehearsal with checksums.
- All four role logins with migrated accounts.
- Launcher sign-in from an installed (packaged) build.
- Drop-in `results.json` → visible to all four roles.
- Recording upload of a real-length video at the target size.
- Offline → reconnect.
- Expired-token recovery.
- Learner switch on one PC.

**Production**
- Post-cutover smoke test.
- One real Unreal session per room type.
- Admin integration-health page at 100%.
- Monitor `audit_events` for `Failed` entries.

---

## 10. Open Questions

1. Which branch or commit is Vercel production on, and which `vercel.json` (Root Directory) does the project use?
2. Read-only access to Neon, or a dump, for the data inventory: row counts, roles, Postgres version.
3. Is the dev Supabase project the pre-Neon database? Should its legacy row `haseeb@gmail.com` stay?
4. How should legacy `training_sessions` be shown: graded by score as Pass/Review/Fail, marked reviewed, or hidden?
5. Production domain(s), for `FRONTEND_URL` and the launcher build.
6. The Unreal build:
   - does it implement `-AuthSessionPath` / `-ResultsPath` and write `results.json`?
   - which recording method, resolution and expected file size?
7. Supabase plan and region for production.

---

## GO / NO-GO

| Area | Verdict | Why |
| --- | --- | --- |
| Local development | **GO** | Builds, typecheck and lint pass; the dev Supabase schema is current; logins verified. Commit the work first |
| Production DB migration | **NO-GO (yet)** | Technically low-risk: a data copy, no auth migration, no refactor. Blocked on: branch reconciliation, a production data inventory, the legacy-session decision, and a staging rehearsal |
| Production VR integration | **NO-GO** | No Unreal implementation verified. The launcher can't target production URLs. Recording size limits are unresolved. The end-to-end path has never run |
