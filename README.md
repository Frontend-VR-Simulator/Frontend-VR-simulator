
A login-based web app with a React frontend and a Node.js backend, using Supabase for authentication and JWT for session handling.

It also includes an Electron desktop launcher that authenticates through the
system browser and starts an installed, packaged Unreal Engine VR application.

## Project Structure

```text
/
├── frontend/       # React app (Vite)
├── backend/        # Node.js API server
└── desktop/        # Electron + React + TypeScript launcher
```

## Routes (Frontend)

| Route | Purpose |
| --- | --- |
| `/` | Login page (the only route) |

There is currently only one route. After a successful login, the app does not navigate anywhere else — it stays on the same page.

## 1. Requirements

- Node.js (LTS recommended)
- npm
- A [Supabase](https://supabase.com) account

## 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New Project**.
3. Give it a name, set a database password (save this somewhere safe — you'll need it in the next step), and choose a region close to you.
4. Wait for the project to finish provisioning — this takes a minute or two.

## 3. Get Your Database Connection String (`DB_URL`)

This is a separate value from the API keys in the next step — it's what lets the backend talk directly to your database.

1. From the Supabase dashboard, click **Connect** at the top of the page.
2. Click the **Direct connection** tab.
3. Look down you will see 3 options select **Session pooler** section.
4. Copy the connection string shown under **Shared Pooler**.
5. while storing this in Backend .env replace **[Your_db password]** with your actual DB password remove brackets as well.
6. Paste it into your backend `.env` file as `DB_URL` (see [Environment Variables](#6-environment-variables) below). The connection string will already contain a placeholder for your password — replace that placeholder with the database password you set in step 2.

## 4. Get Your API Keys

1. From the Supabase dashboard, click **Connect** at the top of the page.
2. In the panel that opens, you'll see tabs like **Framework** and **Server** — click **Server**.
3. Scroll down until you see a text field with your connection details.
4. Copy the first 3 values shown there:
   - Your **Project URL** → this is your `SUPABASE_URL`
   - Your **publishable (anon) key** → this is your `SUPABASE_PUBLISHABLE_KEY`
   - Your **secret (service_role) key** → this is your `SUPABASE_SECRET_KEY`
5. Paste these into the `.env` file inside your `backend/` folder (see [Environment Variables](#6-environment-variables) below).

> ⚠️ The secret key has full access to your database. Only use it in the backend — never in the frontend, and never share it publicly.

## 5. Generate a JWT Secret

1. Go to [jwtsecretkeygenerator.com](https://jwtsecretkeygenerator.com/).
2. Generate a standard secret key.
3. Copy the generated key and store it as `JWT_SECRET` in your backend `.env` file.

## 6. Environment Variables

Neither `.env` file is included in this project — only `.env.example` files. You must create your own `.env` files (one in `backend/`, one in `frontend/`) and fill in the values below.

### Backend — `backend/.env`

```env
# Database connection string (from Connect → Direct connection → Session pooler → Shared Pooler)
DB_URL=your-database-connection-string

# Supabase project URL
SUPABASE_URL=your-supabase-project-url

# Supabase publishable (anon/public) key — safe to expose on the frontend
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Supabase secret (service_role) key — backend only, never expose this on the frontend
SUPABASE_SECRET_KEY=your-supabase-secret-key

# Secret used to sign/verify JWTs — generate one at https://jwtsecretkeygenerator.com/
JWT_SECRET=your-own-jwt-secret
```

### Frontend — `frontend/.env`

This file is much simpler — it just needs to know where your backend is running:

```env
# The URL where your backend server is running
VITE_API_URL=http://localhost:8000/api/v1
```

> ⚠️ **Never commit your `.env` files or share your Supabase secret key / JWT secret / database connection string publicly.** These give elevated access to your database and to signed-in sessions.

## 7. Setup — Backend

```bash
cd backend
npm i
```

Copy the example environment file and fill in your own values (see [Environment Variables](#6-environment-variables) above):

```bash
cp .env.example .env
```

Now create the database table automatically by running:

```bash
npm run db:setup
```

This runs a script that creates the `users` table for you, with these columns:  `id` `name`, `email`, `role`, and `password` and `created_at`. You do **not** need to create this table by hand in the Supabase dashboard — the script does it. The `role` column only accepts one of three values: `admin`, `head`, or `employee`.

You donot need to call this command every time you run the backend just first time when you are configuring Backend


Once that's done, start the backend:

```bash
npm start
```

## 8. Setup — Frontend

```bash
cd frontend
npm i
```

Copy the example environment file and fill in your own values (see [Environment Variables](#6-environment-variables) above). Unlike the backend, this file just needs one thing — the address of your backend server:

```bash
cp .env.example .env
```

Run the frontend:

```bash
npm run dev
```

This will start the frontend on the URL printed in your terminal (usually `http://localhost:5173`).

## 9. Quick Start (for whoever receives this project)

```bash
# Backend
cd backend
npm i
cp .env.example .env   # fill in DB_URL, Supabase keys, and JWT_SECRET
npm run db:setup        # creates the users table automatically
npm start

# Frontend (in a separate terminal)
cd frontend
npm i
cp .env.example .env   # fill in VITE_API_URL (your backend's address)
npm run dev
```

## 10. After a Successful Login

When you press login and the login is successful, you must save the token that is returned from the login response (for example, in `localStorage`, a cookie, or in-memory app state, depending on how the app is set up) so that it can be used to authenticate future requests.

There is a variable named `response` when the user successfully logs in — it holds the full response from the backend, which includes:

```bash
role: "Employee"
token: abc
userAllowed: true
```

The variable `response` catches all the data from the backend, which also includes a message, status, and code. To save the token, use:

```bash
response.data.data.token
```

## 11. All Endpoints

There are 3 URLs:

```bash
http://localhost:8000/api/v1/user/login # used for login, sends back token, status, and role. Requires email and password.

http://localhost:8000/api/v1/user/signup # used for creating a user, sends back the same things (token, status, role). Requires name, email, password, role. Role should be employee, admin, or head.

http://localhost:8000/api/v1/user/check-login # used to check whether the user is logged in or logged out. Requires the token that you stored at the time of login or signup. Returns a bool for whether the user is logged in, and the role.

http://localhost:8000/api/v1/user/desktop-code # authenticated, creates a single-use 60-second desktop code

http://localhost:8000/api/v1/user/desktop-token # exchanges the single-use code for a desktop session
```

## 12. Electron desktop launcher

Install and run the frontend and backend first. In a third terminal:

```bash
cd desktop
npm install
npm run dev
```

The first time the launcher opens, choose the `.exe` for the installed packaged
VR simulation. This is the game executable, not Unreal Editor. The selection is
remembered in Electron's user-data directory. After this one-time setup, the
launcher does not display the executable path or offer an application-change
control; it silently uses the saved executable on subsequent starts.

Click **Sign in**. The launcher opens the web login in the default system
browser. After authentication, the browser returns a one-time code to the
launcher, which stores its private session encrypted with Electron
`safeStorage`, writes the Unreal handoff JSON, and starts the chosen executable.
On later launcher starts, a valid saved session and remembered executable path
cause the already-installed VR application to start automatically, with no
browser login round-trip. The launcher remains visible after the VR process
starts so the user can log out at any time. Logging out closes the VR process
tree started by the launcher and removes the authentication files.

By default the handoff is `ue-session.json` in Electron's user-data directory.
The launcher passes its absolute path to Unreal as:

```text
-AuthSessionPath=C:\absolute\path\to\ue-session.json
```

The Unreal application should read that command-line value and parse:

```json
{
  "userId": "user-id",
  "accessToken": "jwt",
  "isLoggedIn": true
}
```

Set `VR_SESSION_PATH` to an absolute writable path if the Unreal integration
requires a fixed location. The handoff contains a bearer token and must not be
committed, logged, or placed in the application installation directory. It is
removed on logout. The Electron-only `session.enc` remains encrypted and is not
intended for Unreal to read.

Configuration defaults are documented in `desktop/.env.example`. For a Windows
NSIS installer, run on Windows:

```bash
cd desktop
npm run build
```

Running the NSIS installer again clears prior launcher sessions, saved VR paths,
and handoff files. Uninstalling the launcher also removes its application data.

For a local unpacked build without producing an installer:

```bash
npm run build:dir
```
