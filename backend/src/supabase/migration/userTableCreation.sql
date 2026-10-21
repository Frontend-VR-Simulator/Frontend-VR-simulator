CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'trainee'
        CHECK (role IN ('admin', 'head', 'trainer', 'trainee')),
    employee_id TEXT UNIQUE,
    batch TEXT,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade installations created with the former employee role.
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS batch TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = CASE role WHEN 'employee' THEN 'trainee' ELSE role END;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'trainee';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'head', 'trainer', 'trainee'));

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'head', 'trainer', 'trainee')),
    employee_id TEXT UNIQUE NOT NULL,
    batch TEXT,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS desktop_auth_codes (
    code_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('admin', 'head', 'trainer', 'trainee'));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_auth_codes ENABLE ROW LEVEL SECURITY;

-- VR results ingestion. A session is one results file written by the VR app,
-- covering 1 to 11 rooms. external_id is its sessionId and blocks duplicates.
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'room';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS room_id TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'Review';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS critical_errors INTEGER NOT NULL DEFAULT 0;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS rooms JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS recording_status TEXT NOT NULL DEFAULT 'Unavailable';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS recording_path TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS recording_bytes BIGINT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_session_type_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_session_type_check CHECK (session_type IN ('room', 'complete'));
-- Every session is now a run through 1 to 11 rooms ('complete'); rooms inside it are
-- each counted as an attempt at that room. Older single-room sessions are converted.
UPDATE training_sessions SET session_type = 'complete' WHERE session_type <> 'complete';
ALTER TABLE training_sessions ALTER COLUMN session_type SET DEFAULT 'complete';
-- Older sessions stored rooms scored out of 100 and divided a run by all 11 rooms.
-- Rescore them over the rooms played. Rooms stored with maxPoints are already current.
UPDATE training_sessions
SET score = sub.score,
    result = CASE
        WHEN training_sessions.critical_errors > 0 THEN 'Fail'
        WHEN sub.score >= 80 THEN 'Pass'
        WHEN sub.score >= 70 THEN 'Review'
        ELSE 'Fail' END
FROM (
    SELECT id, ROUND(AVG((room->>'score')::numeric), 2) AS score
    FROM training_sessions, jsonb_array_elements(rooms) AS room
    GROUP BY id
    HAVING bool_and(NOT (room ? 'maxPoints'))
) AS sub
WHERE training_sessions.id = sub.id AND training_sessions.score <> sub.score;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_result_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_result_check CHECK (result IN ('Pass', 'Review', 'Fail'));
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_recording_status_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_recording_status_check CHECK (recording_status IN ('Processing', 'Ready', 'Unavailable'));
CREATE INDEX IF NOT EXISTS training_sessions_trainee_idx ON training_sessions (trainee_id, completed_at);
CREATE INDEX IF NOT EXISTS training_sessions_room_idx ON training_sessions (room_id);

CREATE TABLE IF NOT EXISTS session_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'learner' CHECK (visibility IN ('learner', 'private')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_feedback_session_idx ON session_feedback (session_id);

-- A program assigns an ordered set of rooms to one batch (cohort) with a deadline.
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    batch TEXT NOT NULL,
    room_ids TEXT[] NOT NULL,
    due_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'platform',
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_label TEXT NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'Successful' CHECK (outcome IN ('Successful', 'In progress', 'Failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events (created_at DESC);

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Private bucket for session recordings. The launcher uploads with a signed URL;
-- the web app plays recordings through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-recordings', 'session-recordings', false)
ON CONFLICT (id) DO NOTHING;
