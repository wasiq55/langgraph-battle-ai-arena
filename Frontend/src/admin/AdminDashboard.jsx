import { useCallback, useEffect, useRef, useState } from "react";

const sections = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "users", label: "Users", icon: "♙" },
  { id: "questions", label: "AI Questions", icon: "✳" },
  { id: "conversations", label: "Conversations", icon: "▤" },
  { id: "files", label: "Files & Uploads", icon: "↥" }
];

const cx = (...classes) => classes.filter(Boolean).join(" ");

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function formatContent(value, fallback = "No data available.") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getInitials(value = "User") {
  return String(value)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (["completed", "success", "active"].includes(value)) return "green";
  if (["failed", "error", "blocked"].includes(value)) return "red";
  if (["pending", "processing", "in_progress"].includes(value)) return "yellow";
  return "neutral";
}

function formatBytes(bytes = 0) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function fileId(file) {
  return String(file?._id || file?.id || file?.fileId || "");
}

function fileName(file) {
  return file?.metadata?.originalName ||
    file?.originalName ||
    file?.filename ||
    file?.name ||
    "Unnamed file";
}

function fileType(file) {
  return file?.contentType ||
    file?.metadata?.contentType ||
    file?.mimetype ||
    "application/octet-stream";
}

function cxButton() {
  return "rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
}

function Badge({ children, tone = "neutral" }) {
  const tones = {
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    yellow: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    purple: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    neutral: "border-white/10 bg-white/5 text-slate-300"
  };

  return (
    <span className={cx(
      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
      tones[tone] || tones.neutral
    )}>
      {children || "Unknown"}
    </span>
  );
}

function Avatar({ name }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/10 text-sm font-bold text-lime-200">
      {getInitials(name)}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-slate-400">
        ⌕
      </div>
      <p className="mt-4 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={cx(
      "min-w-0 rounded-2xl border border-white/10 bg-[#111722] shadow-lg shadow-black/10",
      className
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-5 text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function StatCard({ label, value, description, icon, accent = "lime" }) {
  const accents = {
    lime: "bg-lime-300/10 text-lime-300",
    blue: "bg-sky-400/10 text-sky-300",
    purple: "bg-violet-400/10 text-violet-300",
    orange: "bg-orange-400/10 text-orange-300"
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111722] p-5 transition hover:border-white/20 hover:bg-[#151d2a]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg", accents[accent] || accents.lime)}>
          {icon}
        </div>
      </div>
      <p className="mt-5 break-words text-3xl font-bold tracking-tight text-white">
        {formatContent(value, "—")}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function DataTable({ columns, rows, emptyTitle, emptyDescription }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <EmptyState title={emptyTitle || "No records found"} description={emptyDescription || "Records will appear here when available."} />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-semibold first:pl-2 last:pr-2">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((row, index) => (
            <tr key={row._id || row.id || row.conversationId || row.chatId || index} className="transition hover:bg-white/[0.025]">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-4 align-middle first:pl-2 last:pr-2">
                  {column.render ? column.render(row) : <span className="text-slate-300">{formatContent(row[column.key], "—")}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentBlock({ title, value }) {
  return (
    <div className="mt-4 min-w-0 border-t border-white/10 pt-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h4>
      <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-white/[0.03] p-3 font-sans text-sm leading-6 text-slate-300">
        {formatContent(value)}
      </pre>
    </div>
  );
}

function Pagination({ page, totalPages, loading, onPrevious, onNext }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
      <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <button disabled={page <= 1 || loading} onClick={onPrevious} className={cxButton()}>Previous</button>
        <button disabled={page >= totalPages || loading} onClick={onNext} className={cxButton()}>Next</button>
      </div>
    </div>
  );
}

function FileIcon({ type }) {
  let icon = "▤";
  if (type.startsWith("image/")) icon = "▧";
  else if (type.startsWith("video/")) icon = "▶";
  else if (type.startsWith("audio/")) icon = "♫";
  else if (type.includes("pdf")) icon = "PDF";
  else if (type.includes("word") || type.includes("document")) icon = "DOC";
  else if (type.includes("spreadsheet") || type.includes("excel")) icon = "XLS";

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/[0.07] text-sm font-bold text-lime-200">
      {icon}
    </div>
  );
}

export default function AdminDashboard({ apiUrl, user, onLogout, onBack }) {
  const [section, setSection] = useState("overview");
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [questionStatus, setQuestionStatus] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [questionPage, setQuestionPage] = useState(1);
  const [conversationPage, setConversationPage] = useState(1);
  const [filePage, setFilePage] = useState(1);
  const [fileSearch, setFileSearch] = useState("");
  const [fileSearchInput, setFileSearchInput] = useState("");
  const [pagination, setPagination] = useState({});
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [filePreviewError, setFilePreviewError] = useState("");
  const [fileBusyId, setFileBusyId] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const previewUrlRef = useRef("");

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("battlearena_token");
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token || ""}`,
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || `Request failed (${response.status})`);
    }
    return data;
  }, [apiUrl]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsResult, usersResult, questionsResult, conversationsResult] = await Promise.all([
        request("/api/admin/stats"),
        request("/api/admin/users?page=1&limit=5"),
        request("/api/admin/questions?page=1&limit=5"),
        request("/api/admin/conversations?page=1&limit=5")
      ]);

      setStats(statsResult.stats || statsResult.data || {});
      setUsers(Array.isArray(usersResult.users) ? usersResult.users : []);
      setQuestions(Array.isArray(questionsResult.questions) ? questionsResult.questions : []);
      setConversations(Array.isArray(conversationsResult.conversations) ? conversationsResult.conversations : []);
      setPagination({
        users: usersResult.pagination || {},
        questions: questionsResult.pagination || {},
        conversations: conversationsResult.pagination || {}
      });
    } catch (err) {
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadUsers = useCallback(async (page = userPage, term = search) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10", search: term });
      const data = await request(`/api/admin/users?${params}`);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPagination((old) => ({ ...old, users: data.pagination || {} }));
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [request, userPage, search]);

  const loadQuestions = useCallback(async (page = questionPage, status = questionStatus) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (status !== "all") params.set("status", status);
      const data = await request(`/api/admin/questions?${params}`);
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setPagination((old) => ({ ...old, questions: data.pagination || {} }));
    } catch (err) {
      setError(err.message || "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }, [request, questionPage, questionStatus]);

  const loadConversations = useCallback(async (page = conversationPage) => {
    setLoading(true);
    setError("");
    try {
      const data = await request(`/api/admin/conversations?page=${page}&limit=10`);
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setPagination((old) => ({ ...old, conversations: data.pagination || {} }));
    } catch (err) {
      setError(err.message || "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [request, conversationPage]);

  const loadFiles = useCallback(async (page = filePage, term = fileSearch) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        search: term
      });
      const data = await request(`/api/admin/files?${params}`);
      setFiles(Array.isArray(data.files) ? data.files : []);
      setPagination((old) => ({ ...old, files: data.pagination || {} }));
    } catch (err) {
      setFiles([]);
      setError(err.message || "Unable to load uploaded files.");
    } finally {
      setLoading(false);
    }
  }, [request, filePage, fileSearch]);

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setFilePreviewUrl("");
  }, []);

  const closeFilePreview = useCallback(() => {
    clearPreviewUrl();
    setSelectedFile(null);
    setFilePreviewError("");
    setFilePreviewLoading(false);
  }, [clearPreviewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const fetchFileBlob = useCallback(async (file) => {
    const id = fileId(file);
    if (!id) throw new Error("This file record does not contain a file ID.");

    const token = localStorage.getItem("battlearena_token");
    const response = await fetch(`${apiUrl}/api/files/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token || ""}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || `File request failed (${response.status})`);
    }
    return response.blob();
  }, [apiUrl]);

  const previewFile = async (file) => {
    closeFilePreview();
    setSelectedFile(file);
    setFilePreviewLoading(true);
    setFilePreviewError("");

    try {
      const blob = await fetchFileBlob(file);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setFilePreviewUrl(url);
    } catch (err) {
      setFilePreviewError(err.message || "Unable to preview this file.");
    } finally {
      setFilePreviewLoading(false);
    }
  };

  const downloadFile = async (file) => {
    const id = fileId(file);
    setFileBusyId(id);
    setError("");
    try {
      const blob = await fetchFileBlob(file);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(file);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || "Unable to download file.");
    } finally {
      setFileBusyId("");
    }
  };

  const openUserDetails = async (row) => {
    setSelectedUser(row);
    setSelectedUserDetails(null);
    setSelectedUserLoading(true);
    try {
      const data = await request(`/api/admin/users/${encodeURIComponent(row._id)}/details`);
      setSelectedUserDetails(data);
    } catch (err) {
      setSelectedUserDetails({ error: err.message || "Unable to load this user's history." });
    } finally {
      setSelectedUserLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (section === "users") loadUsers(userPage, search);
    if (section === "questions") loadQuestions(questionPage, questionStatus);
    if (section === "conversations") loadConversations(conversationPage);
    if (section === "files") loadFiles(filePage, fileSearch);
  }, [
    section,
    userPage,
    questionPage,
    conversationPage,
    filePage,
    fileSearch,
    questionStatus,
    loadUsers,
    loadQuestions,
    loadConversations,
    loadFiles
  ]);

  const totalUsers = stats.totalUsers ?? stats.usersCount ?? stats.users ?? "—";
  const totalQuestions = stats.totalQuestions ?? stats.totalBattles ?? stats.questionsCount ?? "—";
  const completed = stats.completedQuestions ?? stats.completedBattles ?? stats.completed ?? "—";
  const failed = stats.failedQuestions ?? stats.failedBattles ?? stats.failed ?? "—";

  const currentSection = sections.find((item) => item.id === section);
  const pageInfo = pagination[section] || {};
  const currentPage = section === "users"
    ? userPage
    : section === "questions"
      ? questionPage
      : section === "conversations"
        ? conversationPage
        : filePage;

  const setCurrentPage = section === "users"
    ? setUserPage
    : section === "questions"
      ? setQuestionPage
      : section === "conversations"
        ? setConversationPage
        : setFilePage;

  const totalPages = Math.max(1, Number(pageInfo.pages || pageInfo.totalPages || 1));

  const openSection = (id) => {
    setSection(id);
    setMobileMenu(false);
    setError("");
  };

  const refreshCurrent = () => {
    if (section === "overview") return loadOverview();
    if (section === "users") return loadUsers();
    if (section === "questions") return loadQuestions();
    if (section === "conversations") return loadConversations();
    if (section === "files") return loadFiles();
  };

  const userColumns = [
    {
      key: "user",
      label: "User",
      render: (row) => {
        const name = row.name || row.username || row.fullName || "Unnamed user";
        return (
          <div className="flex items-center gap-3">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="max-w-56 truncate font-semibold text-white">{name}</p>
              <p className="mt-1 max-w-56 truncate text-xs text-slate-400">{row.email || "No email"}</p>
            </div>
          </div>
        );
      }
    },
    {
      key: "role",
      label: "Role",
      render: (row) => <Badge tone={row.role === "admin" ? "purple" : "blue"}>{row.role || "user"}</Badge>
    },
    {
      key: "createdAt",
      label: "Joined",
      render: (row) => <span className="whitespace-nowrap text-slate-400">{formatDate(row.createdAt || row.updatedAt)}</span>
    },
    {
      key: "profile",
      label: "Profile",
      render: (row) => (
        <button onClick={() => openUserDetails(row)} className="whitespace-nowrap rounded-lg border border-lime-300/20 px-3 py-2 text-xs font-semibold text-lime-200 hover:bg-lime-300/10">
          View profile →
        </button>
      )
    }
  ];

  const questionColumns = [
    {
      key: "question",
      label: "Question",
      render: (row) => (
        <button onClick={() => setSelectedQuestion(row)} className="block max-w-lg text-left">
          <span className="line-clamp-2 font-medium leading-6 text-white hover:text-lime-300">{formatContent(row.question, "Untitled question")}</span>
          <span className="mt-1 block text-xs text-slate-500">{row.userEmail || row.userId || "Unknown user"}</span>
        </button>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status || "unknown"}</Badge>
    },
    {
      key: "createdAt",
      label: "Created",
      render: (row) => <span className="whitespace-nowrap text-slate-400">{formatDate(row.createdAt)}</span>
    },
    {
      key: "details",
      label: "Details",
      render: (row) => <button onClick={() => setSelectedQuestion(row)} className={cxButton()}>View details</button>
    }
  ];

  const conversationColumns = [
    {
      key: "title",
      label: "Conversation",
      render: (row) => (
        <button onClick={() => setSelectedConversation(row)} className="max-w-lg text-left">
          <span className="line-clamp-2 font-semibold leading-6 text-white hover:text-lime-300">{row.title || "Untitled conversation"}</span>
          <span className="mt-1 block text-xs text-slate-500">ID: {String(row.conversationId || row._id || "—").slice(0, 24)}</span>
        </button>
      )
    },
    {
      key: "user",
      label: "User",
      render: (row) => <span className="break-all text-slate-300">{row.userId?.email || row.userEmail || row.email || row.userId?._id || row.userId || "—"}</span>
    },
    {
      key: "turns",
      label: "Turns",
      render: (row) => <Badge>{Array.isArray(row.turns) ? row.turns.length : row.messageCount ?? 0}</Badge>
    },
    {
      key: "updatedAt",
      label: "Last activity",
      render: (row) => <span className="whitespace-nowrap text-slate-400">{formatDate(row.updatedAt || row.createdAt)}</span>
    },
    {
      key: "details",
      label: "Details",
      render: (row) => <button onClick={() => setSelectedConversation(row)} className={cxButton()}>View</button>
    }
  ];

  const closeModals = () => {
    setSelectedQuestion(null);
    setSelectedUser(null);
    setSelectedUserDetails(null);
    setSelectedConversation(null);
  };

  const renderQuestionDetails = (question) => (
    <>
      <ContentBlock title="Submitted question" value={question.question} />
      <ContentBlock title="AI response 1" value={question.solution1 ?? question.solution_1} />
      <ContentBlock title="AI response 2" value={question.solution2 ?? question.solution_2} />
      <ContentBlock title="Judge evaluation" value={question.judge} />
      {question.errorMessage && <p className="mt-3 break-words text-sm text-rose-300">Error: {question.errorMessage}</p>}
    </>
  );

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-200">
      <div className="flex min-h-screen">
        {mobileMenu && <button aria-label="Close menu overlay" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-black/70 lg:hidden" />}

        <aside className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#0d121b] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300 text-lg font-black text-slate-950">A</div>
            <div>
              <p className="font-bold tracking-tight text-white">AI Arena</p>
              <p className="mt-0.5 text-xs text-slate-500">Control Center</p>
            </div>
            <button onClick={() => setMobileMenu(false)} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden">✕</button>
          </div>

          <div className="px-4 pt-7">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            <nav className="space-y-1.5">
              {sections.map((item) => (
                <button key={item.id} onClick={() => openSection(item.id)} className={cx(
                  "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition",
                  section === item.id ? "border border-lime-300/15 bg-lime-300/10 text-lime-200" : "border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
                )}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                  {section === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-lime-300" />}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center gap-3">
                <Avatar name={user?.name || user?.username || user?.email || "Admin"} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user?.name || user?.username || "Administrator"}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email || "Admin account"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Admin session active</div>
              <button onClick={onLogout} className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-slate-300 hover:border-rose-400/30 hover:bg-rose-400/5 hover:text-rose-300">Sign out</button>
              {onBack && <button onClick={onBack} className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-400 hover:bg-white/5">Back to chat</button>}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-white/10 bg-[#090d14]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-9">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileMenu(true)} className="rounded-xl border border-white/10 p-2.5 text-slate-300 hover:bg-white/5 lg:hidden">☰</button>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">AI Arena / Admin</p>
                <h1 className="mt-1 truncate text-lg font-bold tracking-tight text-white sm:text-xl">{currentSection?.label || "Overview"}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs font-medium text-emerald-300 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" />API connected</div>
              <button onClick={refreshCurrent} className={cxButton()}>↻ <span className="hidden sm:inline">Refresh</span></button>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
            {error && (
              <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-rose-300">Unable to load data</p>
                  <p className="mt-1 break-words text-sm text-rose-200/80">{error}</p>
                </div>
                <button onClick={refreshCurrent} className="shrink-0 rounded-lg border border-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-300/10">Try again</button>
              </div>
            )}

            {section === "overview" && (
              <>
                <div className="relative overflow-hidden rounded-3xl border border-lime-300/15 bg-gradient-to-br from-[#18251d] via-[#111a20] to-[#111722] p-6 sm:p-8 lg:p-10">
                  <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-3 py-1.5 text-xs font-semibold text-lime-200"><span className="h-2 w-2 rounded-full bg-lime-300" />ADMINISTRATOR WORKSPACE</div>
                      <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">Your AI Arena, at a glance.</h2>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">Monitor users, inspect AI battles, review conversations, and manage uploaded files from one dashboard.</p>
                    </div>
                    <button onClick={() => openSection("questions")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-lime-200">Explore AI questions →</button>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">Platform overview</h2>
                  <p className="mt-1 text-sm text-slate-400">A snapshot of your AI Arena activity.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total users" value={totalUsers} description="Registered platform accounts" icon="♙" accent="blue" />
                  <StatCard label="Total AI questions" value={totalQuestions} description="Questions recorded by the platform" icon="✳" accent="purple" />
                  <StatCard label="Completed battles" value={completed} description="Questions processed successfully" icon="✓" accent="lime" />
                  <StatCard label="Failed battles" value={failed} description="Questions that need attention" icon="!" accent="orange" />
                </div>
                <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                  <Panel title="Recent users" subtitle="Latest registered accounts" action={<button onClick={() => openSection("users")} className="text-sm font-semibold text-lime-300">View all →</button>}>
                    {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading users…</p> : <DataTable rows={users.slice(0, 5)} columns={[userColumns[0], userColumns[1]]} emptyTitle="No users to display" emptyDescription="Registered users will appear here." />}
                  </Panel>
                  <Panel title="Recent AI questions" subtitle="Latest submitted questions" action={<button onClick={() => openSection("questions")} className="text-sm font-semibold text-lime-300">View all →</button>}>
                    {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading questions…</p> : <DataTable rows={questions.slice(0, 5)} columns={questionColumns.slice(0, 2)} emptyTitle="No AI questions yet" emptyDescription="Questions submitted through the arena will appear here." />}
                  </Panel>
                </div>
              </>
            )}

            {section === "users" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">User management</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Search accounts and inspect each user's activity history.</p>
                </div>
                <Panel title="All users" subtitle="Search by name or email address">
                  <form onSubmit={(event) => { event.preventDefault(); setUserPage(1); loadUsers(1, search); }} className="mb-5 flex flex-col gap-3 sm:flex-row">
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users by name or email…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1018] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/40" />
                    <button type="submit" className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-lime-200">Search users</button>
                  </form>
                  {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading users…</p> : <DataTable rows={users} columns={userColumns} emptyTitle="No matching users" emptyDescription="Try another search term." />}
                  <Pagination page={currentPage} totalPages={totalPages} loading={loading} onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))} onNext={() => setCurrentPage((page) => page + 1)} />
                </Panel>
              </>
            )}

            {section === "questions" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">AI question monitoring</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Inspect prompts, responses, judge reasoning, and processing status.</p>
                </div>
                <Panel title="Question records" subtitle="Select a question to inspect its complete details" action={
                  <select value={questionStatus} onChange={(event) => { setQuestionStatus(event.target.value); setQuestionPage(1); }} className="rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-sm text-slate-200 outline-none">
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                }>
                  {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading questions…</p> : <DataTable rows={questions} columns={questionColumns} emptyTitle="No questions found" emptyDescription="Try another status filter." />}
                  <Pagination page={currentPage} totalPages={totalPages} loading={loading} onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))} onNext={() => setCurrentPage((page) => page + 1)} />
                </Panel>
              </>
            )}

            {section === "conversations" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Conversation history</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Browse chat sessions and inspect each stored conversation.</p>
                </div>
                <Panel title="Stored conversations" subtitle="Open a conversation to view its turns and attachments">
                  {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading conversations…</p> : <DataTable rows={conversations} columns={conversationColumns} emptyTitle="No conversations found" emptyDescription="Saved chat sessions will appear here." />}
                  <Pagination page={currentPage} totalPages={totalPages} loading={loading} onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))} onNext={() => setCurrentPage((page) => page + 1)} />
                </Panel>
              </>
            )}

            {section === "files" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Files & Uploads</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Browse files stored in MongoDB GridFS, preview supported formats, and download original files.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Files on this page" value={files.length} description="Files returned by the current page" icon="▤" accent="lime" />
                  <StatCard label="Current page" value={filePage} description={`Page ${filePage} of ${Math.max(1, Number((pagination.files || {}).pages || (pagination.files || {}).totalPages || 1))}`} icon="◫" accent="blue" />
                  <StatCard label="Storage" value="GridFS" description="MongoDB file storage" icon="▦" accent="purple" />
                </div>

                <Panel title="Uploaded files" subtitle="Search by filename or content type">
                  <form onSubmit={(event) => { event.preventDefault(); setFilePage(1); setFileSearch(fileSearchInput.trim()); }} className="mb-5 flex flex-col gap-3 sm:flex-row">
                    <input value={fileSearchInput} onChange={(event) => setFileSearchInput(event.target.value)} placeholder="Search files by name or type…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1018] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/40" />
                    <button type="submit" className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-lime-200">Search files</button>
                    <button type="button" onClick={() => { setFileSearchInput(""); setFileSearch(""); setFilePage(1); }} className={cxButton()}>Clear</button>
                  </form>

                  {loading ? (
                    <p className="py-10 text-center text-sm text-slate-400">Loading uploaded files…</p>
                  ) : files.length === 0 ? (
                    <EmptyState title="No uploaded files found" description={error ? "Check the backend files route and your database connection." : "Files uploaded by users will appear here when they are saved in the uploads GridFS bucket."} />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {files.map((file) => {
                        const type = fileType(file);
                        const name = fileName(file);
                        const id = fileId(file);
                        const uploader = file.metadata?.userEmail || file.metadata?.email || file.userEmail || file.metadata?.userId || "Unknown user";
                        return (
                          <article key={id || name} className="min-w-0 rounded-2xl border border-white/10 bg-[#0b1018] p-4 transition hover:border-lime-300/20 sm:p-5">
                            <div className="flex min-w-0 items-start gap-3">
                              <FileIcon type={type} />
                              <div className="min-w-0 flex-1">
                                <h3 title={name} className="break-words font-semibold leading-6 text-white">{name}</h3>
                                <p className="mt-1 break-all text-xs leading-5 text-slate-500">{type}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Badge>{formatBytes(file.length ?? file.size)}</Badge>
                                  <Badge tone="blue">{type.split("/")[0] || "file"}</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-4 text-xs text-slate-400">
                              <p className="break-all"><span className="text-slate-500">Uploaded by:</span> {String(uploader)}</p>
                              <p><span className="text-slate-500">Upload date:</span> {formatDate(file.uploadDate || file.createdAt || file.metadata?.uploadedAt)}</p>
                              <p className="break-all"><span className="text-slate-500">File ID:</span> {id || "Missing file ID"}</p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button disabled={!id || filePreviewLoading} onClick={() => previewFile(file)} className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-lime-200 disabled:opacity-40">Preview</button>
                              <button disabled={!id || fileBusyId === id} onClick={() => downloadFile(file)} className={cxButton()}>{fileBusyId === id ? "Downloading…" : "Download ↓"}</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <Pagination page={filePage} totalPages={Math.max(1, Number((pagination.files || {}).pages || (pagination.files || {}).totalPages || 1))} loading={loading} onPrevious={() => setFilePage((page) => Math.max(1, page - 1))} onNext={() => setFilePage((page) => page + 1)} />
                </Panel>
              </>
            )}

            <footer className="flex flex-col justify-between gap-2 border-t border-white/[0.07] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center">
              <p>AI Arena Admin Console</p>
              <p>Manage access responsibly · Data supplied by your backend</p>
            </footer>
          </div>
        </main>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div role="dialog" aria-modal="true" className="my-auto max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111722] text-slate-200 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#111722] p-5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={selectedUser.name || selectedUser.email || "User"} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-lime-300">User activity</p>
                  <h2 className="mt-1 truncate text-xl font-bold text-white">{selectedUser.name || selectedUser.username || selectedUser.email || "User profile"}</h2>
                  <p className="mt-1 truncate text-sm text-slate-400">{selectedUser.email || "No email available"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className={cxButton()}>Close ✕</button>
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              {selectedUserLoading && <p className="py-10 text-center text-slate-400">Loading user history…</p>}
              {selectedUserDetails?.error && <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-rose-300"><p className="font-semibold">Unable to load user history</p><p className="mt-2 break-words text-sm">{selectedUserDetails.error}</p></div>}
              {selectedUserDetails?.success && (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[["Questions", selectedUserDetails.summary?.totalQuestions], ["Conversations", selectedUserDetails.summary?.totalConversations], ["Messages", selectedUserDetails.summary?.totalMessages], ["Uploads", selectedUserDetails.summary?.totalUploads]].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-[#0b1018] p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value ?? 0}</p></div>
                    ))}
                  </div>
                  <section>
                    <h3 className="mb-3 text-lg font-bold text-white">AI questions and answers</h3>
                    <div className="space-y-4">
                      {(selectedUserDetails.questions || []).map((question, index) => (
                        <article key={question._id || index} className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={statusTone(question.status)}>{question.status || "unknown"}</Badge><span className="text-xs text-slate-500">{formatDate(question.createdAt)}</span></div>
                          {renderQuestionDetails(question)}
                        </article>
                      ))}
                      {!selectedUserDetails.questions?.length && <EmptyState title="No question records" description="No matching Question records were found for this user." />}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-3 text-lg font-bold text-white">Conversations and uploads</h3>
                    <div className="space-y-4">
                      {(selectedUserDetails.conversations || []).map((conversation, index) => (
                        <article key={conversation._id || index} className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
                          <h4 className="font-semibold text-white">{conversation.title || "Untitled conversation"}</h4>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(conversation.updatedAt || conversation.createdAt)}</p>
                          {(conversation.turns || []).map((turn, turnIndex) => (
                            <div key={turn._id || turnIndex} className="mt-4 rounded-lg border border-white/[0.07] p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-lime-300">Question {turnIndex + 1}</p>
                              <ContentBlock title="Question" value={turn.question} />
                              <ContentBlock title="AI response 1" value={turn.solution_1} />
                              <ContentBlock title="AI response 2" value={turn.solution_2} />
                              <ContentBlock title="Judge evaluation" value={turn.judge} />
                              {(turn.attachments || []).map((file, fileIndex) => <p key={fileIndex} className="mt-2 break-all text-sm text-sky-300">{formatContent(file)}</p>)}
                            </div>
                          ))}
                          {!conversation.turns?.length && <p className="mt-3 text-sm text-slate-500">No turns stored in this conversation.</p>}
                        </article>
                      ))}
                      {!selectedUserDetails.conversations?.length && <EmptyState title="No conversations found" description="No saved conversations were found for this user." />}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-3 text-lg font-bold text-white">Individual messages</h3>
                    <div className="space-y-3">
                      {(selectedUserDetails.messages || []).map((message, index) => (
                        <article key={message._id || index} className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={statusTone(message.status)}>{message.status || "unknown"}</Badge><span className="text-xs text-slate-500">{formatDate(message.createdAt)}</span></div>
                          <ContentBlock title="Message question" value={message.question} />
                          <ContentBlock title="Response" value={message.response} />
                        </article>
                      ))}
                      {!selectedUserDetails.messages?.length && <EmptyState title="No individual messages" description="No matching Message records were found." />}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={() => setSelectedQuestion(null)}>
          <div role="dialog" aria-modal="true" className="my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111722] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/10 bg-[#111722] px-5 py-4 sm:px-6">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-lime-300">Question details</p><h2 className="mt-2 text-lg font-bold text-white">AI Arena submission</h2></div>
              <button onClick={() => setSelectedQuestion(null)} className={cxButton()}>Close ✕</button>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(selectedQuestion.status)}>{selectedQuestion.status || "unknown"}</Badge><span className="text-xs text-slate-500">{formatDate(selectedQuestion.createdAt)}</span></div>
              {renderQuestionDetails(selectedQuestion)}
              <p className="break-all text-xs text-slate-500">User: {selectedQuestion.userEmail || selectedQuestion.userId || "Unknown"}</p>
            </div>
          </div>
        </div>
      )}

      {selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={() => setSelectedConversation(null)}>
          <div role="dialog" aria-modal="true" className="my-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111722] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#111722] p-5">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-lime-300">Conversation details</p><h2 className="mt-2 text-xl font-bold text-white">{selectedConversation.title || "Untitled conversation"}</h2><p className="mt-1 break-all text-xs text-slate-500">{selectedConversation.conversationId || selectedConversation._id || ""}</p></div>
              <button onClick={() => setSelectedConversation(null)} className={cxButton()}>Close ✕</button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-slate-400">Last activity: {formatDate(selectedConversation.updatedAt || selectedConversation.createdAt)}</p>
              {(selectedConversation.turns || []).map((turn, index) => (
                <article key={turn._id || index} className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-lime-300">Turn {index + 1}</p>
                  <ContentBlock title="Question" value={turn.question} />
                  <ContentBlock title="AI response 1" value={turn.solution_1} />
                  <ContentBlock title="AI response 2" value={turn.solution_2} />
                  <ContentBlock title="Judge evaluation" value={turn.judge} />
                  {Array.isArray(turn.attachments) && turn.attachments.length > 0 && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Attachments</p>{turn.attachments.map((file, index) => <p key={index} className="mt-2 break-all text-sm text-sky-300">{formatContent(file)}</p>)}</div>}
                </article>
              ))}
              {!selectedConversation.turns?.length && <EmptyState title="No turns found" description="This conversation has no stored turns." />}
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6" onClick={closeFilePreview}>
          <div role="dialog" aria-modal="true" className="my-auto flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111722] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-lime-300">File preview</p>
                <h2 className="mt-2 break-words font-bold text-white">{fileName(selectedFile)}</h2>
                <p className="mt-1 break-all text-xs text-slate-500">{fileType(selectedFile)} · {formatBytes(selectedFile.length ?? selectedFile.size)}</p>
              </div>
              <button onClick={closeFilePreview} className={cxButton()}>Close ✕</button>
            </div>
            <div className="min-h-64 flex-1 overflow-auto p-4 sm:p-6">
              {filePreviewLoading && <p className="py-16 text-center text-slate-400">Loading file preview…</p>}
              {!filePreviewLoading && filePreviewError && <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300">{filePreviewError}</div>}
              {!filePreviewLoading && !filePreviewError && filePreviewUrl && (
                <>
                  {fileType(selectedFile).startsWith("image/") && <img src={filePreviewUrl} alt={fileName(selectedFile)} className="mx-auto max-h-[65vh] max-w-full rounded-lg object-contain" />}
                  {fileType(selectedFile) === "application/pdf" && <iframe title={fileName(selectedFile)} src={filePreviewUrl} className="h-[65vh] w-full rounded-lg bg-white" />}
                  {fileType(selectedFile).startsWith("video/") && <video src={filePreviewUrl} controls className="mx-auto max-h-[65vh] max-w-full rounded-lg" />}
                  {fileType(selectedFile).startsWith("audio/") && <div className="flex min-h-48 flex-col items-center justify-center gap-5"><span className="text-5xl text-lime-300">♫</span><audio src={filePreviewUrl} controls className="w-full max-w-xl" /></div>}
                  {!fileType(selectedFile).startsWith("image/") && fileType(selectedFile) !== "application/pdf" && !fileType(selectedFile).startsWith("video/") && !fileType(selectedFile).startsWith("audio/") && (
                    <div className="py-12 text-center">
                      <FileIcon type={fileType(selectedFile)} />
                      <p className="mt-4 font-semibold text-white">Preview is not available for this file type.</p>
                      <p className="mt-2 text-sm text-slate-400">Download the file to open it on your device.</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 p-4">
              <button onClick={() => downloadFile(selectedFile)} disabled={fileBusyId === fileId(selectedFile)} className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-lime-200 disabled:opacity-40">{fileBusyId === fileId(selectedFile) ? "Downloading…" : "Download file ↓"}</button>
              <button onClick={closeFilePreview} className={cxButton()}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
