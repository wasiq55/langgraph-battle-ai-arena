
import { useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://langgraph-battle-ai-arena-4id8.onrender.com");

function SparkIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
      <path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.1 3.8" />
      <path d="M6.2 6.3C3.5 8.2 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.3 3.3-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function MiniChat({ label, text, delay = "" }) {
  return (
    <div
      className={`relative max-w-[92%] rounded-2xl border border-white/[0.09] bg-[#151b24]/95 p-3.5 shadow-2xl sm:p-4 ${delay}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime-300/10 text-lime-300">
          <SparkIcon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {label}
        </span>
      </div>
      <p className="text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">
        {text}
      </p>
    </div>
  );
}

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isSignup && name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (isSignup && password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/${isSignup ? "signup" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...(isSignup ? { name: name.trim() } : {}),
            email: email.trim().toLowerCase(),
            password
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Authentication failed."
        );
      }

      if (!data.token || !data.user) {
        throw new Error("The server returned an invalid response.");
      }

      localStorage.setItem("battlearena_token", data.token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to AI Arena. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(isSignup ? "login" : "signup");
    setError("");
    setPassword("");
    setShowPassword(false);
  }

  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#080b10] text-white selection:bg-lime-300 selection:text-black">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-36 -top-36 h-80 w-80 rounded-full bg-lime-300/[0.07] blur-[100px] sm:h-[28rem] sm:w-[28rem]" />
        <div className="absolute -bottom-40 -right-36 h-80 w-80 rounded-full bg-emerald-400/[0.06] blur-[100px] sm:h-[30rem] sm:w-[30rem]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.3)_1px,transparent_1px)] [background-size:38px_38px] sm:[background-size:48px_48px]" />
      </div>

      <header className="relative z-10 flex h-[72px] items-center justify-between border-b border-white/[0.07] px-4 sm:px-8 lg:px-12">
        <a href="#" className="flex items-center gap-3" aria-label="AI Arena home">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-lime-300 text-slate-950 shadow-lg shadow-lime-300/10">
            <SparkIcon className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-extrabold tracking-tight sm:text-lg">
              AI <span className="text-lime-300">ARENA</span>
            </span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Intelligence, compared
            </span>
          </span>
        </a>

        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" />
          </span>
          <span className="text-[10px] font-semibold text-slate-400 sm:text-xs">
            AI workspace
          </span>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-72px)] w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex flex-col justify-center px-5 pb-8 pt-9 sm:px-10 sm:pb-10 sm:pt-12 lg:px-14 lg:py-14 xl:px-20">
          <div className="mx-auto w-full max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/15 bg-lime-300/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-lime-200 sm:text-xs">
              <SparkIcon className="h-4 w-4" />
              Your next-gen AI workspace
            </div>

            <h1 className="mt-6 max-w-2xl text-[2.65rem] font-black leading-[1.05] tracking-[-0.055em] sm:mt-8 sm:text-6xl lg:text-6xl xl:text-7xl">
              One question.
              <br />
              <span className="bg-gradient-to-r from-lime-200 via-lime-300 to-emerald-300 bg-clip-text text-transparent">
                Multiple minds.
              </span>
              <br />
              Better answers.
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:mt-6 sm:text-base sm:leading-8">
              Step into a smarter way to explore ideas. Compare AI responses,
              challenge different perspectives, and discover answers with AI Arena.
            </p>

            <div className="mt-8 hidden space-y-4 sm:mt-10 sm:block">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/[0.07] text-lime-300">
                  <SparkIcon className="h-4 w-4" />
                </span>
                Compare multiple AI perspectives
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/[0.07] text-lime-300">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v18M3 12h18" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </span>
                Explore ideas, code, and complex questions
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/[0.07] text-lime-300">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5 9.5 17 19 7" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </span>
                Keep your conversations in one workspace
              </div>
            </div>

            <div className="mt-8 hidden max-w-md sm:mt-10 sm:block">
              <div className="relative rounded-3xl border border-white/[0.08] bg-[#0d121a]/80 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-5">
                <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-300 text-slate-950">
                      <SparkIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">Arena preview</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">A smarter conversation</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[9px] font-semibold text-emerald-300">
                    READY
                  </span>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-lime-300 px-4 py-3 text-xs font-medium leading-5 text-slate-950">
                    How can I turn a big idea into a real project?
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  <MiniChat
                    label="AI perspective 01"
                    text="Break it into a clear goal, small milestones, and a first working prototype."
                  />
                  <div className="flex justify-end">
                    <MiniChat
                      label="AI perspective 02"
                      text="Start with the user problem, validate your approach, and improve with feedback."
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-white/[0.07] pt-4">
                  <div className="flex h-8 flex-1 items-center rounded-xl border border-white/[0.08] bg-black/20 px-3 text-[10px] text-slate-500">
                    Ask something interesting...
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-300 text-slate-950">
                    <ArrowIcon />
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 hidden items-center gap-3 text-[10px] text-slate-600 sm:flex">
              <span className="h-px w-8 bg-slate-700" />
              BUILT FOR THE CURIOUS
              <span className="h-px w-8 bg-slate-700" />
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-4 pb-8 pt-2 sm:px-8 sm:pb-12 sm:pt-5 lg:px-10 lg:py-12 xl:px-16">
          <div className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-96 -translate-y-1/2 rounded-full bg-lime-300/[0.035] blur-[90px] lg:block" />

          <div className="relative w-full max-w-[440px]">
            <div className="mb-5 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/[0.08] text-lime-300">
                <SparkIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">
                  Welcome to the Arena
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Your next conversation starts here.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#0e131b]/95 shadow-2xl shadow-black/40 sm:rounded-[30px]">
              <div className="border-b border-white/[0.07] px-5 py-6 sm:px-8 sm:py-8">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      {isSignup ? "Create your identity" : "Member access"}
                    </span>
                  </div>
                  <span className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10px] text-slate-500">
                    AI ARENA
                  </span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {isSignup ? "Join the Arena." : "Welcome back."}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {isSignup
                    ? "Create your account and start exploring."
                    : "Sign in and pick up where your curiosity left off."}
                </p>

                <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/[0.07] bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSignup) switchMode();
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      !isSignup
                        ? "bg-lime-300 text-slate-950 shadow-md shadow-lime-300/10"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSignup) switchMode();
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      isSignup
                        ? "bg-lime-300 text-slate-950 shadow-md shadow-lime-300/10"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Create account
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
                {isSignup && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="mb-2 block text-xs font-semibold text-slate-300"
                    >
                      Full name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      maxLength={100}
                      minLength={2}
                      required
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#090d13] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-lime-300/50 focus:ring-4 focus:ring-lime-300/[0.06]"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-2 block text-xs font-semibold text-slate-300"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">
                      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                    </span>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#090d13] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-lime-300/50 focus:ring-4 focus:ring-lime-300/[0.06]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Password
                    </label>
                    {isSignup && (
                      <span className="text-[10px] text-slate-500">
                        8 characters minimum
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">
                      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="10" width="16" height="11" rx="2" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                    </span>
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        isSignup
                          ? "Create a strong password"
                          : "Enter your password"
                      }
                      autoComplete={
                        isSignup ? "new-password" : "current-password"
                      }
                      minLength={isSignup ? 8 : undefined}
                      maxLength={128}
                      required
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#090d13] pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-lime-300/50 focus:ring-4 focus:ring-lime-300/[0.06]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 transition hover:text-lime-300"
                    >
                      <EyeIcon visible={showPassword} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm leading-6 text-rose-300"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-lime-300/[0.08] transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-lime-300/15 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      {isSignup ? "Creating your account..." : "Signing you in..."}
                    </>
                  ) : (
                    <>
                      {isSignup ? "Create your account" : "Enter the Arena"}
                      <ArrowIcon />
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] leading-5 text-slate-500">
                  {isSignup
                    ? "Your AI journey starts with one account."
                    : "Your workspace is waiting for you."}
                </p>
              </form>

              <div className="border-t border-white/[0.07] px-5 py-4 text-center sm:px-8">
                <p className="text-xs text-slate-500">
                  {isSignup ? "Already part of the Arena?" : "New to AI Arena?"}
                  <button
                    type="button"
                    onClick={switchMode}
                    className="ml-1.5 font-bold text-lime-300 transition hover:text-lime-200"
                  >
                    {isSignup ? "Sign in instead" : "Create an account"}
                  </button>
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Secure authentication
              </span>
              <span>Built for curious minds</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
