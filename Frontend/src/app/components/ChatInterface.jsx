
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://langgraph-battle-ai-arena-4id8.onrender.com");

const STREAM_URL = `${API_BASE.replace(/\/+$/, "").replace(/\/invoke$/, "")}/invoke/stream`;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_FILES = [
  ".txt", ".md", ".json", ".csv", ".pdf", ".docx", ".xlsx", ".xls",
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".php", ".go", ".rs", ".rb",
  ".swift", ".kt", ".html", ".css", ".scss", ".sql", ".sh", ".bat",
  ".ps1", ".xml", ".yaml", ".yml", ".toml", ".ini", ".log",
  ".jpg", ".jpeg", ".png", ".webp", ".mp3", ".wav", ".m4a",
  ".ogg", ".flac", ".mpga", ".mpeg", ".mp4", ".mov", ".webm"
].join(",");

function getIdentity(user) {
  return user?._id || user?.id || user?.email || "guest";
}

function getHistoryKey(user) {
  return `battlearena_chat_history_v1_${getIdentity(user)}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createChat() {
  return {
    id: makeId(),
    title: "New chat",
    messages: [],
    updatedAt: new Date().toISOString()
  };
}

function readHistory(user) {
  try {
    const stored = localStorage.getItem(getHistoryKey(user));
    const parsed = stored ? JSON.parse(stored) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      chat => chat && chat.id && Array.isArray(chat.messages)
    );
  } catch {
    return [];
  }
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function getFileIcon(name) {
  const extension = name.split(".").pop()?.toLowerCase();

  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "▧";
  if (["mp4", "mov", "webm"].includes(extension)) return "▶";
  if (["mp3", "wav", "m4a", "ogg", "flac"].includes(extension)) return "♫";
  if (extension === "pdf") return "PDF";
  if (extension === "docx") return "DOC";
  if (["xlsx", "xls", "csv"].includes(extension)) return "XLS";

  return "FILE";
}

function MarkdownContent({ children }) {
  return (
    <div className="min-w-0 break-words text-sm leading-7 text-slate-700 [&_a]:text-sky-700 [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_ul]:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {typeof children === "string" ? children : ""}
      </ReactMarkdown>
    </div>
  );
}

function ResponseSection({
  title,
  value,
  accent,
  streaming = false,
  emptyText = "Waiting for response..."
}) {
  const text = typeof value === "string" ? value : "";

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
          <h3 className="truncate text-sm font-semibold text-slate-800">
            {title}
          </h3>
        </div>
        {streaming && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-sky-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            Generating
          </span>
        )}
      </div>
      <div className="min-w-0 px-4 py-4">
        {text ? (
          <>
            <MarkdownContent>{text}</MarkdownContent>
            {streaming && (
              <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-sky-500 align-middle" />
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">
            {streaming ? "Generating your solution..." : emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function JudgeSection({ judge }) {
  if (!judge) return null;

  const score1 = Number(judge.solution_1_score);
  const score2 = Number(judge.solution_2_score);
  const valid1 = Number.isFinite(score1);
  const valid2 = Number.isFinite(score2);

  let winner = "Scores unavailable";

  if (valid1 && valid2) {
    winner = score1 > score2
      ? "Solution 1 wins"
      : score2 > score1
        ? "Solution 2 wins"
        : "It's a tie";
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            ✓
          </span>
          <h3 className="text-sm font-semibold text-slate-800">
            Judge's verdict
          </h3>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
          {winner}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Solution 1</p>
            <p className="text-lg font-bold tabular-nums text-sky-700">
              {valid1 ? `${score1}/10` : "—"}
            </p>
          </div>
          <MarkdownContent>
            {judge.solution_1_reasoning || "No reasoning provided."}
          </MarkdownContent>
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Solution 2</p>
            <p className="text-lg font-bold tabular-nums text-violet-700">
              {valid2 ? `${score2}/10` : "—"}
            </p>
          </div>
          <MarkdownContent>
            {judge.solution_2_reasoning || "No reasoning provided."}
          </MarkdownContent>
        </div>
      </div>
    </section>
  );
}

function AttachmentChip({ file, onRemove, disabled }) {
  return (
    <div className="flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-1 text-[10px] font-bold text-slate-600">
        {getFileIcon(file.name)}
      </span>
      <span className="max-w-44 truncate text-xs font-medium text-slate-700">
        {file.name}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="ml-1 rounded-md px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
      >
        ×
      </button>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500" />
      <span className="ml-2 text-xs text-slate-500">Preparing your response</span>
    </div>
  );
}

export default function ChatInterface({ user, onLogout }) {
  const [chats, setChats] = useState(() => readHistory(user));
  const [activeChatId, setActiveChatId] = useState(() => {
    const history = readHistory(user);
    return history[0]?.id || null;
  });
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const accountRef = useRef(null);
  const activeChatIdRef = useRef(activeChatId);
  const busyRef = useRef(false);

  const activeChat = chats.find(chat => chat.id === activeChatId) || null;
  const messages = activeChat?.messages || [];

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    localStorage.setItem(getHistoryKey(user), JSON.stringify(chats));
  }, [chats, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const updateChat = useCallback((chatId, updater) => {
    setChats(previous =>
      previous.map(chat => {
        if (chat.id !== chatId) return chat;

        const updated =
          typeof updater === "function" ? updater(chat) : updater;

        return {
          ...updated,
          updatedAt: new Date().toISOString()
        };
      })
    );
  }, []);

  const startNewChat = useCallback(() => {
    if (busyRef.current) return;

    const chat = createChat();

    setChats(previous => [chat, ...previous]);
    setActiveChatId(chat.id);
    activeChatIdRef.current = chat.id;
    setInput("");
    setFiles([]);
    setError("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, []);

  const selectChat = useCallback((chatId) => {
    if (busyRef.current) return;

    setActiveChatId(chatId);
    activeChatIdRef.current = chatId;
    setInput("");
    setFiles([]);
    setError("");
    setSidebarOpen(false);
  }, []);

  const addFiles = useCallback((incomingFiles) => {
    if (busyRef.current) return;

    const incoming = Array.from(incomingFiles || []);
    const accepted = [];
    const problems = [];
    const existingNames = new Set(files.map(file => `${file.name}-${file.size}`));

    for (const file of incoming) {
      const key = `${file.name}-${file.size}`;

      if (existingNames.has(key)) continue;

      if (files.length + accepted.length >= MAX_FILES) {
        problems.push(`You can upload a maximum of ${MAX_FILES} files.`);
        break;
      }

      if (file.size > MAX_FILE_SIZE) {
        problems.push(`${file.name} exceeds the 10 MB file limit.`);
        continue;
      }

      accepted.push(file);
      existingNames.add(key);
    }

    setFiles(previous => [...previous, ...accepted]);

    if (problems.length) {
      setError(problems.join(" "));
    } else {
      setError("");
    }
  }, [files]);

  const removeFile = useCallback((index) => {
    setFiles(previous => previous.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  async function sendMessage(event) {
    event?.preventDefault();

    if (busyRef.current) return;

    const prompt = input.trim();

    if (!prompt && files.length === 0) return;

    let chatId = activeChatIdRef.current;
    let chat = chats.find(item => item.id === chatId);

    if (!chat) {
      chat = createChat();
      chatId = chat.id;
      activeChatIdRef.current = chatId;
      setActiveChatId(chatId);
      setChats(previous => [chat, ...previous]);
    }

    const currentFiles = [...files];
    const userMessage = {
      id: makeId(),
      role: "user",
      content: prompt,
      attachments: currentFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      })),
      createdAt: new Date().toISOString()
    };

    const assistantMessage = {
      id: makeId(),
      role: "assistant",
      content: "",
      solution_1: "",
      solution_2: "",
      judge: null,
      streaming: true,
      createdAt: new Date().toISOString()
    };

    updateChat(chatId, currentChat => ({
      ...currentChat,
      title: currentChat.messages.length === 0
        ? (prompt || currentFiles[0]?.name || "New chat").slice(0, 48)
        : currentChat.title,
      messages: [
        ...currentChat.messages,
        userMessage,
        assistantMessage
      ]
    }));

    setInput("");
    setFiles([]);
    setError("");
    setBusy(true);
    busyRef.current = true;

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const token = localStorage.getItem("battlearena_token");

      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const formData = new FormData();

      formData.append("input", prompt);
      formData.append("conversationId", chatId);

      for (const file of currentFiles) {
        formData.append("files", file);
      }

      const response = await fetch(STREAM_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("battlearena_token");
          onLogout?.();
          throw new Error("Your session has expired. Please sign in again.");
        }

        throw new Error(
          data.error || data.message || "Unable to start the AI response."
        );
      }

      if (!response.body) {
        throw new Error("Your browser does not support response streaming.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      function updateAssistant(patch) {
        updateChat(chatId, currentChat => ({
          ...currentChat,
          messages: currentChat.messages.map(message =>
            message.id === assistantMessage.id
              ? { ...message, ...patch }
              : message
          )
        }));
      }

      function processEvent(eventText) {
        const dataLine = eventText
          .split("\n")
          .find(line => line.startsWith("data: "));

        if (!dataLine) return;

        const event = JSON.parse(dataLine.slice(6));

        if (event.type === "delta") {
          if (event.solution === "solution_1") {
            updateChat(chatId, currentChat => ({
              ...currentChat,
              messages: currentChat.messages.map(message =>
                message.id === assistantMessage.id
                  ? {
                      ...message,
                      solution_1: message.solution_1 + event.text
                    }
                  : message
              )
            }));
          }

          if (event.solution === "solution_2") {
            updateChat(chatId, currentChat => ({
              ...currentChat,
              messages: currentChat.messages.map(message =>
                message.id === assistantMessage.id
                  ? {
                      ...message,
                      solution_2: message.solution_2 + event.text
                    }
                  : message
              )
            }));
          }
        }

        if (event.type === "judge") {
          updateAssistant({ judge: event.judge });
        }

        if (event.type === "complete") {
          completed = true;

          updateAssistant({
            solution_1: event.result?.solution_1 ?? "",
            solution_2: event.result?.solution_2 ?? "",
            judge: event.result?.judge ?? null,
            streaming: false
          });
        }

        if (event.type === "error") {
          throw new Error(event.message || "The AI response failed.");
        }
      }

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventText of events) {
          processEvent(eventText);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processEvent(buffer);
      }

      if (!completed) {
        throw new Error("The stream ended before the response was completed.");
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while generating the response.";

      updateChat(chatId, currentChat => ({
        ...currentChat,
        messages: currentChat.messages.map(item =>
          item.id === assistantMessage.id
            ? {
                ...item,
                streaming: false,
                error: message
              }
            : item
        )
      }));

      setError(message);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  const suggestions = [
    {
      title: "Solve a coding problem",
      prompt: "Explain an efficient solution to a coding problem and analyze its time and space complexity."
    },
    {
      title: "Review my code",
      prompt: "Review my code for bugs, performance issues, and improvements."
    },
    {
      title: "Explain a difficult topic",
      prompt: "Explain a difficult technical topic step by step with practical examples."
    },
    {
      title: "Analyze an uploaded file",
      prompt: "Analyze the uploaded file and summarize its most important information."
    }
  ];

  const displayName = user?.name || user?.email || "User";
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-[100dvh] overflow-hidden bg-[#f7f9fc] text-slate-800"
      onDragOver={event => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3 14.4 9.6 21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900">
              Battle AI Arena
            </h1>
            <p className="text-xs text-slate-500">Compare AI solutions</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 md:hidden"
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            New chat
          </button>
        </div>

        <div className="px-5 pb-2 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Recent conversations
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {chats.length === 0 && (
            <p className="px-3 py-5 text-xs leading-5 text-slate-400">
              Your conversations will appear here.
            </p>
          )}

          {chats
            .slice()
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .map(chat => (
              <button
                type="button"
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                disabled={busy}
                className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition disabled:opacity-60 ${chat.id === activeChatId ? "bg-sky-50 text-sky-900" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="1.7">
                  <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-5.5A2.5 2.5 0 0 1 5 13V5.5Z" strokeLinejoin="round" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {chat.title || "New chat"}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {formatDate(chat.updatedAt)}
                  </span>
                </span>
              </button>
            ))}
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">Signed in</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600"
              title="Sign out"
              aria-label="Sign out"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>

            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                AI Battle Workspace
              </h2>
              <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                Two models. Two solutions. One judge.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">
                Arena ready
              </span>
            </div>

            <button
              type="button"
              onClick={startNewChat}
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              New chat
            </button>

            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen(value => !value)}
                className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100"
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  {initials}
                </span>
                <svg viewBox="0 0 24 24" fill="none" className="hidden h-4 w-4 text-slate-500 sm:block" stroke="currentColor" strokeWidth="2">
                  <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-4">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {user?.email || ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      onLogout?.();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <span>↗</span>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              {!messages.length ? (
                <div className="flex min-h-[55vh] flex-col items-center justify-center py-8 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 2.8 14.5 9.5 21.2 12l-6.7 2.5L12 21.2l-2.5-6.7L2.8 12l6.7-2.5L12 2.8Z" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Let's start a battle
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
                    Ask a question or upload a file. Groq and Cohere will generate
                    independent solutions, then an AI judge will compare them.
                  </p>

                  <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
                    {suggestions.map(suggestion => (
                      <button
                        type="button"
                        key={suggestion.title}
                        onClick={() => setInput(suggestion.prompt)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
                      >
                        <span className="block text-sm font-semibold text-slate-800">
                          {suggestion.title}
                        </span>
                        <span className="mt-1.5 block text-xs leading-5 text-slate-500">
                          {suggestion.prompt}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {messages.map(message => (
                    <article key={message.id} className="min-w-0">
                      {message.role === "user" ? (
                        <div className="ml-auto max-w-3xl">
                          <div className="rounded-2xl rounded-br-md bg-sky-600 px-4 py-3 text-sm leading-6 text-white shadow-sm sm:px-5">
                            {message.content && (
                              <p className="whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            )}

                            {message.attachments?.length > 0 && (
                              <div className={`flex flex-wrap gap-2 ${message.content ? "mt-3" : ""}`}>
                                {message.attachments.map((file, index) => (
                                  <span
                                    key={`${file.name}-${index}`}
                                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-xs"
                                  >
                                    <span className="shrink-0 text-[10px] font-bold">
                                      {getFileIcon(file.name)}
                                    </span>
                                    <span className="max-w-48 truncate">
                                      {file.name}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="mt-1.5 text-right text-[11px] text-slate-400">
                            You
                          </p>
                        </div>
                      ) : (
                        <div className="min-w-0 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7">
                                <path d="M12 3 14.3 9.7 21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Battle AI Arena
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {message.streaming ? "Generating responses" : "Response complete"}
                              </p>
                            </div>
                          </div>

                          {message.content &&
                            !message.solution_1 &&
                            !message.solution_2 && (
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <MarkdownContent>{message.content}</MarkdownContent>
                              </div>
                            )}

                          <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
                            <ResponseSection
                              title="Solution 1 · Groq"
                              value={message.solution_1}
                              accent="bg-sky-500"
                              streaming={Boolean(message.streaming && !message.solution_1)}
                            />

                            <ResponseSection
                              title="Solution 2 · Cohere"
                              value={message.solution_2}
                              accent="bg-violet-500"
                              streaming={Boolean(message.streaming && !message.solution_2)}
                            />
                          </div>

                          {message.streaming &&
                            !message.solution_1 &&
                            !message.solution_2 && <LoadingDots />}

                          {message.judge && (
                            <JudgeSection judge={message.judge} />
                          )}

                          {message.streaming && !message.judge && (
                            <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                              {message.solution_1 && message.solution_2
                                ? "Both solutions are ready. The judge is evaluating them..."
                                : "Solutions are streaming independently..."}
                            </div>
                          )}

                          {message.error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                              <p className="font-semibold">Response interrupted</p>
                              <p className="mt-1 break-words">{message.error}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-3 pt-3 sm:px-6 sm:pb-5 lg:px-8">
            <div className="mx-auto max-w-5xl">
              {error && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <p className="break-words">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="shrink-0 font-semibold"
                    aria-label="Dismiss error"
                  >
                    ×
                  </button>
                </div>
              )}

              {files.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <AttachmentChip
                      key={`${file.name}-${file.size}-${index}`}
                      file={file}
                      disabled={busy}
                      onRemove={() => removeFile(index)}
                    />
                  ))}
                </div>
              )}

              <form
                onSubmit={sendMessage}
                className={`rounded-2xl border bg-white shadow-sm transition ${dragging ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-50"}`}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={event => {
                    setInput(event.target.value);
                    event.target.style.height = "auto";
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Message Battle AI Arena..."
                  rows={1}
                  disabled={busy}
                  className="max-h-[180px] min-h-[54px] w-full resize-none bg-transparent px-4 pb-2 pt-4 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 sm:px-5"
                />

                <div className="flex items-center justify-between gap-3 px-3 pb-3 sm:px-4">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_FILES}
                      className="hidden"
                      onChange={event => {
                        addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy || files.length >= MAX_FILES}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:text-sm"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                        <path d="m8.5 12.5 6.8-6.8a3.2 3.2 0 0 1 4.5 4.5l-8.9 8.9a5 5 0 0 1-7.1-7.1l8.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="hidden sm:inline">Attach files</span>
                      <span className="sm:hidden">Attach</span>
                    </button>

                    <span className="hidden text-[11px] text-slate-400 sm:inline">
                      Up to 10 files · 10 MB each
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || (!input.trim() && files.length === 0)}
                    className="flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {busy ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        <span className="hidden sm:inline">Generating</span>
                      </>
                    ) : (
                      <>
                        <span>Send</span>
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <p className="mt-2 text-center text-[10px] leading-4 text-slate-400 sm:text-xs">
                AI-generated answers can contain mistakes. Compare both solutions and review the judge's reasoning.
              </p>
            </div>
          </div>
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50/95">
            <div className="text-center">
              <div className="text-3xl text-sky-600">＋</div>
              <p className="mt-2 text-base font-semibold text-sky-800">
                Drop files to attach
              </p>
              <p className="mt-1 text-sm text-sky-700">
                Documents, code, images, audio and video
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
