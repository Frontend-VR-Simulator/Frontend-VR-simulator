import { useState, useEffect, useRef, useLayoutEffect } from "react";
import axios from "axios";

import { VirtualKeyboard } from "./virtual-keyboard";
import { API_BASE_URL } from "../config/api";

function readDesktopRequest() {
  const params = new URLSearchParams(window.location.search);
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  if (!redirectUri) return { redirect: null, error: "" };

  try {
    const parsed = new URL(redirectUri);
    const validHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (parsed.protocol !== "http:" || !validHost || parsed.pathname !== "/callback" || parsed.search || parsed.hash || !state) {
      throw new Error("Invalid desktop sign-in request.");
    }
    return { redirect: { redirectUri: parsed.toString(), state }, error: "" };
  } catch {
    return { redirect: null, error: "Invalid desktop sign-in request. Please return to the desktop app and try again." };
  }
}

const LoginPage = ({ onLogin }) => {
  const [desktopRequest] = useState(readDesktopRequest);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(desktopRequest.error);
  const desktopRedirect = desktopRequest.redirect;

  /* 'email' | 'password' | null */
  const [activeField, setActiveField] = useState(null);

  /* ---- Cursor / selection tracking ---- */
  const [emailSel, setEmailSel] = useState({ start: 0, end: 0 });
  const [passwordSel, setPasswordSel] = useState({ start: 0, end: 0 });

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  /* Keep latest values available in keydown listener without re-attaching */
  const emailValRef = useRef(email);
  const passwordValRef = useRef(password);
  useEffect(() => { emailValRef.current = email; }, [email]);
  useEffect(() => { passwordValRef.current = password; }, [password]);

  /* Restore cursor position after React overwrites the DOM on re-render */
  useLayoutEffect(() => {
    if (activeField === "email" && emailRef.current) {
      emailRef.current.setSelectionRange(emailSel.start, emailSel.end);
    }
  }, [email, emailSel, activeField]);

  useLayoutEffect(() => {
    if (activeField === "password" && passwordRef.current) {
      passwordRef.current.setSelectionRange(passwordSel.start, passwordSel.end);
    }
  }, [password, passwordSel, activeField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActiveField(null);
    setError("");
    setIsLoading(true);

    try {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        setError("Please enter a valid email address.");
        return;
      }
      const response = await axios.post(
        `${API_BASE_URL}/user/login`,
        { email, password },
      );

      if (desktopRedirect) {
        const token = response.data?.data?.token;
        const codeResponse = await axios.post(
          `${API_BASE_URL}/user/desktop-code`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const callback = new URL(desktopRedirect.redirectUri);
        callback.searchParams.set("code", codeResponse.data.code);
        callback.searchParams.set("state", desktopRedirect.state);
        window.location.assign(callback.toString());
      } else {
        onLogin?.(response.data.data);
      }
    } catch (error) {
      console.error("Login request failed:", error);
      if (error.response) {
        setError(
          error.response.data?.message || "Login failed. Try again later."
        );
      } else {
        setError("Unable to connect to the server. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- Physical keyboard bridge ---------------- */
  useEffect(() => {
    if (!activeField) return;

    const onKeyDown = (e) => {
      // Let browser shortcuts pass through (Ctrl+R, Ctrl+C, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const ref = activeField === "email" ? emailRef : passwordRef;
      const start = ref.current?.selectionStart ?? 0;
      const end = ref.current?.selectionEnd ?? 0;
      const currentValue =
        activeField === "email" ? emailValRef.current : passwordValRef.current;

      if (e.key === "Backspace") {
        e.preventDefault();
        let newValue, newPos;

        if (start !== end) {
          // Delete selection
          newValue = currentValue.slice(0, start) + currentValue.slice(end);
          newPos = start;
        } else if (start > 0) {
          // Delete character before cursor
          newValue =
            currentValue.slice(0, start - 1) + currentValue.slice(start);
          newPos = start - 1;
        } else {
          return; // nothing to delete
        }

        if (activeField === "email") {
          setEmail(newValue);
          setEmailSel({ start: newPos, end: newPos });
        } else {
          setPassword(newValue);
          setPasswordSel({ start: newPos, end: newPos });
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeField === "email") {
          setActiveField("password");
          setTimeout(() => passwordRef.current?.focus(), 0);
        } else {
          document.getElementById("login-form")?.requestSubmit();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveField(null);
      } else if (e.key.length === 1) {
        e.preventDefault();
        // Insert character at cursor position
        const newValue =
          currentValue.slice(0, start) + e.key + currentValue.slice(end);
        const newPos = start + 1;

        if (activeField === "email") {
          setEmail(newValue);
          setEmailSel({ start: newPos, end: newPos });
        } else {
          setPassword(newValue);
          setPasswordSel({ start: newPos, end: newPos });
        }
      }
      // ArrowLeft / ArrowRight / Home / End are left untouched so the
      // browser moves the caret natively; onSelect captures the new position.
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeField]); // listener only re-attaches when field changes

  /* ---------------- Selection tracking ---------------- */
  const handleSelect = (field) => (e) => {
    const { selectionStart, selectionEnd } = e.target;
    if (field === "email") {
      setEmailSel({ start: selectionStart, end: selectionEnd });
    } else {
      setPasswordSel({ start: selectionStart, end: selectionEnd });
    }
  };

  /* ---------------- Virtual keyboard helpers ---------------- */
  const getActiveSelection = () => {
    if (activeField === "email") return emailSel;
    if (activeField === "password") return passwordSel;
    return { start: 0, end: 0 };
  };

  const handleVirtualKey = (key) => {
    if (!activeField) return;
    const { start, end } = getActiveSelection();
    const currentValue = activeField === "email" ? email : password;

    const newValue = currentValue.slice(0, start) + key + currentValue.slice(end);
    const newPos = start + key.length;

    if (activeField === "email") {
      setEmail(newValue);
      setEmailSel({ start: newPos, end: newPos });
    } else {
      setPassword(newValue);
      setPasswordSel({ start: newPos, end: newPos });
    }
  };

  const handleVirtualBackspace = () => {
    if (!activeField) return;
    const { start, end } = getActiveSelection();
    const currentValue = activeField === "email" ? email : password;
    let newValue, newPos;

    if (start !== end) {
      newValue = currentValue.slice(0, start) + currentValue.slice(end);
      newPos = start;
    } else if (start > 0) {
      newValue = currentValue.slice(0, start - 1) + currentValue.slice(start);
      newPos = start - 1;
    } else {
      return;
    }

    if (activeField === "email") {
      setEmail(newValue);
      setEmailSel({ start: newPos, end: newPos });
    } else {
      setPassword(newValue);
      setPasswordSel({ start: newPos, end: newPos });
    }
  };

  const handleVirtualClear = () => {
    if (activeField === "email") {
      setEmail("");
      setEmailSel({ start: 0, end: 0 });
    } else if (activeField === "password") {
      setPassword("");
      setPasswordSel({ start: 0, end: 0 });
    }
  };

  const activeLabel =
    activeField === "email"
      ? "Email address"
      : activeField === "password"
      ? "Password"
      : "";

  return (
    /* h-screen + flex-col locks everything to the viewport — no page scroll */
    <main className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Card area: scrolls only if absolutely necessary (tiny screens) */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm sm:max-w-md">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40 p-5 sm:p-6">
            {/* Logo & Header */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-11 h-11 bg-zinc-100 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                <svg
                  className="w-6 h-6 text-zinc-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight text-center">
                LogIn
              </h1>
              <p className="mt-1.5 text-sm text-zinc-400 text-center">
                Log in to your training environment
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-5 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm font-medium"
              >
                {error}
              </div>
            )}

            {/* Form */}
            <form
              id="login-form"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="email"
                  required
                  value={email}
                  inputMode="none"
                  onFocus={() => setActiveField("email")}
                  onClick={() => setActiveField("email")}
                  onSelect={handleSelect("email")}
                  disabled={isLoading}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailSel({
                      start: e.target.selectionStart ?? 0,
                      end: e.target.selectionEnd ?? 0,
                    });
                  }}
                  style={{ caretColor: "#a1a1aa" }}
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm cursor-text"
                  placeholder="you@company.com"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    inputMode="none"
                    onFocus={() => setActiveField("password")}
                    onClick={() => setActiveField("password")}
                    onSelect={handleSelect("password")}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordSel({
                        start: e.target.selectionStart ?? 0,
                        end: e.target.selectionEnd ?? 0,
                      });
                    }}
                    disabled={isLoading}
                    style={{ caretColor: "#a1a1aa" }}
                    className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 pr-12 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm cursor-text"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 focus:outline-none focus:text-zinc-300 disabled:opacity-50 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center items-center rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-600">
            © 2026 VR Simulation Suite. All rights reserved.
          </p>
        </div>
      </div>

      {/* Keyboard docked at bottom — never requires scrolling */}
      {activeField && (
        <div className="shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 w-full flex justify-center">
          <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl">
            <VirtualKeyboard
              activeLabel={activeLabel}
              onKey={handleVirtualKey}
              onBackspace={handleVirtualBackspace}
              onClear={handleVirtualClear}
              onDone={() => setActiveField(null)}
            />
          </div>
        </div>
      )}
    </main>
  );
};

export default LoginPage;
