
import { useCallback, useEffect, useState } from "react";
import AuthPage from "./components/AuthPage";
import ChatInterface from "./components/ChatInterface";
import AdminDashboard from "../admin/AdminDashboard";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://langgraph-battle-ai-arena-4id8.onrender.com");

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
const HOME_PATH = `${BASE_PATH}/`;

function getCurrentPath() {
  const pathname = window.location.pathname.replace(/\/+$/, "");
  return pathname || "/";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [path, setPath] = useState(getCurrentPath());

  const navigate = useCallback((nextPath) => {
    const destination =
      nextPath === "/" ? HOME_PATH : `${BASE_PATH}${nextPath}`;

    window.history.pushState({}, "", destination);
    setPath(getCurrentPath());
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("battlearena_token");
    setUser(null);
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    const handleNavigation = () => setPath(getCurrentPath());

    window.addEventListener("popstate", handleNavigation);

    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      const token = localStorage.getItem("battlearena_token");

      if (!token) {
        if (active) setCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          localStorage.removeItem("battlearena_token");
          if (active) setUser(null);
          return;
        }

        const data = await response.json();

        if (active) setUser(data.user || data);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setCheckingAuth(false);
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-4 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111722] px-5 py-4">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-lime-300" />
          <span className="text-sm text-slate-300">Checking your session...</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage onAuthenticated={setUser} />;
  }

  const isAdminPath = path.replace(/\/+$/, "").endsWith("/admin");

  if (isAdminPath) {
    if (user.role !== "admin") {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-5 text-white">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#111722] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-2xl text-amber-300">!</div>
            <h1 className="mt-5 text-2xl font-bold">Admin access required</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This account does not have administrator permissions. Sign in with an account that has the admin role.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 rounded-xl bg-lime-300 px-5 py-3 font-semibold text-slate-950 hover:bg-lime-200"
            >
              Return to AI Arena
            </button>
            <button
              onClick={logout}
              className="ml-2 mt-6 rounded-xl border border-white/10 px-5 py-3 font-semibold text-slate-300 hover:bg-white/5"
            >
              Logout
            </button>
          </div>
        </main>
      );
    }

    return (
      <AdminDashboard
        apiUrl={API_URL}
        user={user}
        onLogout={logout}
        onBack={() => navigate("/")}
      />
    );
  }

  return (
    <ChatInterface
      key={user._id || user.id || user.email}
      user={user}
      onLogout={logout}
    />
  );
}
