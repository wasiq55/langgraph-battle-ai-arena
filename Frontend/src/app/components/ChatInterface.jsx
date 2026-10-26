import React, { useState, useRef, useEffect, useMemo } from "react";
import UserMessage from "./UserMessage";
import ArenaResponse from "./ArenaResponse";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000/invoke" : "https://langgraph-battle-ai-arena-4id8.onrender.com/invoke");
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const STORAGE_KEY = "battlearena_chat_history_v1";

const ACCEPTED_EXTENSIONS = new Set([
  "pdf", "docx", "txt", "md", "csv", "json", "js", "jsx", "ts", "tsx",
  "py", "java", "c", "cpp", "h", "css", "html", "xml", "yaml", "yml",
  "sql", "sh", "log", "png", "jpg", "jpeg", "webp", "gif", "mp4",
  "webm", "mov", "mp3", "wav", "m4a", "ogg"
]);

const suggestions = [
  { title: "Solve a coding problem", description: "Find an efficient solution to a DSA problem.", prompt: "Explain binary search and implement it in JavaScript.", icon: "⌘" },
  { title: "Compare algorithms", description: "Compare approaches, complexity, and trade-offs.", prompt: "Compare merge sort and quicksort with time and space complexity.", icon: "⇄" },
  { title: "Debug my code", description: "Find bugs and improve an implementation.", prompt: "Explain common causes of memory leaks in JavaScript and how to fix them.", icon: "⌁" },
  { title: "Explore AI and ML", description: "Understand concepts with practical examples.", prompt: "Explain overfitting and underfitting with practical examples.", icon: "✳" }
];

function createChat() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "New chat", messages: [], updatedAt: Date.now() };
}

function readSavedChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) return parsed.filter(chat => chat && chat.id && Array.isArray(chat.messages));
  } catch {}
  return [];
}

function getExtension(filename) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file) {
  const extension = getExtension(file.name);
  if (file.type?.startsWith("image/")) return "▧";
  if (file.type?.startsWith("video/")) return "▷";
  if (file.type?.startsWith("audio/")) return "♫";
  if (extension === "pdf") return "PDF";
  if (["docx", "txt", "md"].includes(extension)) return "DOC";
  if (["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp"].includes(extension)) return "</>";
  if (["csv", "json", "xlsx"].includes(extension)) return "DATA";
  return "FILE";
}

function titleFromPrompt(prompt) {
  const clean = (prompt || "").replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 34 ? `${clean.slice(0, 34).trim()}…` : clean;
}

function safeChatsForStorage(chats) {
  return chats.map(chat => ({
    ...chat,
    messages: chat.messages.map(message => ({
      ...message,
      files: (message.files || []).map(file => ({ ...file, previewUrl: null }))
    }))
  }));
}

export default function ChatInterface() {
  const [sessions, setSessions] = useState(() => {
    const saved = readSavedChats();
    return saved.length ? saved : [createChat()];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = readSavedChats();
    return saved[0]?.id || null;
  });
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef([]);
  const loadingRef = useRef(false);

  const messages = useMemo(
    () => sessions.find(chat => chat.id === activeChatId)?.messages || [],
    [sessions, activeChatId]
  );

  useEffect(() => {
    if (!activeChatId || !sessions.some(chat => chat.id === activeChatId)) {
      setActiveChatId(sessions[0]?.id || null);
    }
  }, [sessions, activeChatId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeChatsForStorage(sessions)));
    } catch (error) {
      console.warn("Could not save chat history in this browser.", error);
    }
  }, [sessions]);

  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => () => {
    attachmentsRef.current.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const updateMessages = updater => {
    if (!activeChatId) return;
    setSessions(previous => previous.map(chat => {
      if (chat.id !== activeChatId) return chat;
      const nextMessages = typeof updater === "function" ? updater(chat.messages) : updater;
      const firstPrompt = nextMessages.find(message => message.problem)?.problem;
      return {
        ...chat,
        messages: nextMessages,
        title: chat.title === "New chat" && firstPrompt ? titleFromPrompt(firstPrompt) : chat.title,
        updatedAt: Date.now()
      };
    }));
  };

  const addFiles = fileList => {
    const incomingFiles = Array.from(fileList || []);
    if (!incomingFiles.length) return;
    setErrorMessage("");
    setAttachments(previous => {
      const next = [...previous];
      const errors = [];
      for (const file of incomingFiles) {
        if (next.length >= MAX_FILES) {
          errors.push(`You can attach up to ${MAX_FILES} files.`);
          break;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name} exceeds the 10 MB limit.`);
          continue;
        }
        if (!ACCEPTED_EXTENSIONS.has(getExtension(file.name))) {
          errors.push(`${file.name} has an unsupported file type.`);
          continue;
        }
        if (next.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        next.push({ file, previewUrl });
      }
      if (errors.length) setErrorMessage(errors.join(" "));
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = index => {
    setAttachments(previous => {
      const item = previous[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return previous.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const clearAttachments = () => {
    setAttachments(previous => {
      previous.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  };

  const startNewChat = () => {
    if (loadingRef.current) return;
    clearAttachments();
    const chat = createChat();
    setSessions(previous => [chat, ...previous]);
    setActiveChatId(chat.id);
    setInputValue("");
    setErrorMessage("");
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const openChat = id => {
    if (loadingRef.current) return;
    clearAttachments();
    setActiveChatId(id);
    setInputValue("");
    setErrorMessage("");
    setSidebarOpen(false);
  };

  const deleteChat = (event, id) => {
    event.stopPropagation();
    if (loadingRef.current) return;
    setSessions(previous => {
      const remaining = previous.filter(chat => chat.id !== id);
      if (!remaining.length) {
        const fresh = createChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) setActiveChatId(remaining[0].id);
      return remaining;
    });
    setErrorMessage("");
  };

  const handleSend = async (event, suggestedPrompt) => {
    event?.preventDefault();
    if (loadingRef.current) return;
    const problem = (suggestedPrompt ?? inputValue).trim();
    const selectedAttachments = [...attachments];
    if (!problem && selectedAttachments.length === 0) return;

    let chatId = activeChatId;
    if (!chatId) {
      const fresh = createChat();
      chatId = fresh.id;
      setSessions(previous => [fresh, ...previous]);
      setActiveChatId(fresh.id);
    }

    loadingRef.current = true;
    setLoading(true);
    setErrorMessage("");
    const displayProblem = problem || "Please analyze the attached files.";
    const messageId = Date.now();

    setSessions(previous => previous.map(chat => chat.id === chatId ? {
      ...chat,
      title: chat.title === "New chat" ? titleFromPrompt(displayProblem) : chat.title,
      updatedAt: Date.now(),
      messages: [...chat.messages, {
        id: messageId,
        problem: displayProblem,
        files: selectedAttachments.map(item => ({
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
          previewUrl: item.previewUrl
        })),
        status: "loading"
      }]
    } : chat));

    setInputValue("");

    try {
      const formData = new FormData();
      formData.append("input", problem);
      selectedAttachments.forEach(item => formData.append("files", item.file));
      const response = await axios.post(API_URL, formData, { timeout: 180000 });
      const result = response.data?.result;

      if (!result || result.solution_1 == null || result.solution_2 == null || !result.judge) {
        throw new Error("The server returned an incomplete response. Please try again.");
      }

      setSessions(previous => previous.map(chat => chat.id === chatId ? {
        ...chat,
        updatedAt: Date.now(),
        messages: chat.messages.map(message => message.id === messageId
          ? { ...message, solution_1: result.solution_1, solution_2: result.solution_2, judge: result.judge, status: "complete" }
          : message)
      } : chat));

      setAttachments(previous => {
        previous.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
        return [];
      });
    } catch (error) {
      console.error("Arena request failed:", error.response?.data || error.message);
      const serverMessage = error.response?.data?.message || error.response?.data?.error;
      let message = serverMessage;
      if (!message && error.code === "ECONNABORTED") message = "The request took too long. Please try again.";
      else if (!message && error.response?.status === 413) message = "The uploaded files are too large for the server.";
      else if (!message && error.code === "ERR_NETWORK") message = `Cannot connect to ${API_URL}. Check that the backend is running and CORS is configured.`;
      else if (!message) message = error.message || "Something went wrong. Please try again.";
      setSessions(previous => previous.map(chat => chat.id === chatId ? {
        ...chat,
        messages: chat.messages.filter(item => item.id !== messageId)
      } : chat));
      setErrorMessage(message);
      setInputValue(problem);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const activeChat = sessions.find(chat => chat.id === activeChatId);
  const sortedSessions = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f7fbfe] font-sans text-slate-800 selection:bg-sky-200/70">
      {sidebarOpen && <button type="button" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[2px] md:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col border-r border-slate-200/90 bg-[#f0f7fb] transition-transform duration-200 md:relative md:z-20 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-200/80 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold tracking-tight text-slate-900">BattleArena</p><p className="text-[9px] tracking-[0.15em] text-slate-400">AI MODEL BATTLES</p></div>
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" className="rounded-lg p-2 text-slate-400 hover:bg-white md:hidden">×</button>
        </div>

        <div className="p-3">
          <button type="button" onClick={startNewChat} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173b52] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245773] disabled:opacity-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New chat
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400">CHAT HISTORY</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-400">{sessions.filter(chat => chat.messages.length > 0).length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {sortedSessions.filter(chat => chat.messages.length > 0 || chat.id === activeChatId).map(chat => (
            <div key={chat.id} className={`group mb-1 flex items-center gap-1 rounded-xl border px-2 transition ${chat.id === activeChatId ? "border-sky-200 bg-white shadow-sm" : "border-transparent hover:bg-white/80"}`}>
              <button type="button" onClick={() => openChat(chat.id)} className="flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={`ml-1 h-4 w-4 shrink-0 ${chat.id === activeChatId ? "text-sky-700" : "text-slate-400"}`}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-1 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className={`min-w-0 flex-1 truncate text-xs ${chat.id === activeChatId ? "font-semibold text-slate-800" : "text-slate-600"}`}>{chat.title || "New chat"}</span>
              </button>
              <button type="button" onClick={event => deleteChat(event, chat.id)} disabled={loading} aria-label={`Delete ${chat.title}`} title="Delete chat" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100">×</button>
            </div>
          ))}
          {sessions.every(chat => chat.messages.length === 0) && <p className="px-4 py-6 text-xs leading-5 text-slate-400">Your conversations will appear here after your first battle.</p>}
        </div>

        <div className="border-t border-slate-200/80 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e1f2fc] text-xs font-semibold text-sky-800">BA</div>
            <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">BattleArena</p><p className="mt-0.5 text-[10px] text-slate-400">History saved in this browser</p></div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open chat history" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 md:hidden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
            </button>
            <div className="min-w-0"><h1 className="truncate text-sm font-semibold tracking-tight text-slate-900">{activeChat?.title && activeChat.title !== "New chat" ? activeChat.title : "Your AI workspace"}</h1><p className="hidden text-[10px] tracking-[0.13em] text-slate-400 sm:block">GROQ · COHERE · INDEPENDENT JUDGE</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Arena ready</span>
            <button type="button" onClick={startNewChat} disabled={loading} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-35">New chat</button>
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isEmpty ? (
            <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-8 text-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-[10px] font-semibold tracking-[0.13em] text-sky-800 shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> TWO MODELS. ONE WINNER.</span>
                  <h2 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-900 sm:text-6xl">A better answer,<br /><span className="text-sky-700">put to the test.</span></h2>
                  <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">Give Groq and Cohere the same challenge. Compare their solutions and let an independent judge score the result.</p>
                </div>
                <div className="mb-8 grid grid-cols-3 gap-3">
                  {[["G", "Groq", "Solution 01"], ["C", "Cohere", "Solution 02"], ["J", "Judge AI", "Final verdict"]].map(([letter, name, subtitle], index) => <div key={name} className="rounded-2xl border border-slate-200/90 bg-white p-3 text-center shadow-[0_8px_24px_rgba(41,75,102,0.035)] sm:p-4"><div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl font-semibold ${index === 0 ? "bg-orange-50 text-orange-700" : index === 1 ? "bg-sky-50 text-sky-700" : "bg-[#eaf7ff] text-sky-800"}`}>{letter}</div><p className="text-xs font-semibold text-slate-800 sm:text-sm">{name}</p><p className="mt-1 text-[10px] text-slate-400 sm:text-xs">{subtitle}</p></div>)}
                </div>
                <p className="mb-3 px-1 text-[10px] font-semibold tracking-[0.16em] text-slate-400">START WITH AN IDEA</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map(suggestion => <button key={suggestion.title} type="button" disabled={loading} onClick={() => handleSend(undefined, suggestion.prompt)} className="group rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_8px_24px_rgba(41,75,102,0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_12px_30px_rgba(41,120,165,0.08)] disabled:opacity-50"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf8ff] text-lg text-sky-700 transition group-hover:bg-sky-100">{suggestion.icon}</div><p className="text-sm font-semibold text-slate-800">{suggestion.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{suggestion.description}</p></button>)}
                </div>
              </div>
            </section>
          ) : (
            <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
              <div className="mx-auto max-w-5xl">
                {messages.map((message, index) => <article key={message.id} className="mb-10">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-[10px] font-semibold text-sky-800">{String(index + 1).padStart(2, "0")}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-400">YOUR CHALLENGE</p>
                      <div className="mt-1"><UserMessage message={message.problem} /></div>
                      {message.files?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.files.map((file, fileIndex) => <div key={`${file.name}-${fileIndex}`} className="flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">{file.previewUrl ? <img src={file.previewUrl} alt={file.name} className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-semibold text-slate-500">{getFileIcon(file)}</span>}<div className="min-w-0"><p className="max-w-48 truncate text-xs text-slate-700">{file.name}</p><p className="text-[10px] text-slate-400">{formatSize(file.size)}</p></div></div>)}</div>}
                    </div>
                  </div>
                  {message.status === "loading" ? <div className="rounded-3xl border border-sky-200/80 bg-white p-5 shadow-sm sm:ml-11 sm:p-7"><div className="flex items-center gap-3"><div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-100 border-t-sky-600" /><div><p className="text-sm font-semibold text-slate-900">The battle is underway</p><p className="mt-1 text-xs text-slate-500">Generating and evaluating both responses...</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{[1, 2].map(item => <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="mb-4 h-3 w-24 animate-pulse rounded bg-slate-200" /><div className="mb-2 h-2 w-full animate-pulse rounded bg-slate-100" /><div className="mb-2 h-2 w-4/5 animate-pulse rounded bg-slate-100" /><div className="h-2 w-3/5 animate-pulse rounded bg-slate-100" /></div>)}</div></div> : <div className="sm:ml-11"><ArenaResponse solution1={message.solution_1} solution2={message.solution_2} judge={message.judge} /></div>}
                </article>)}
              </div>
            </section>
          )}
          <div ref={endOfMessagesRef} />
        </main>

        {errorMessage && <div role="alert" className="mx-auto mb-3 flex w-[calc(100%-2rem)] max-w-3xl items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">!</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-rose-900">The battle could not be completed</p><p className="mt-1 break-words text-xs leading-5 text-rose-800/80">{errorMessage}</p></div><button type="button" onClick={() => setErrorMessage("")} aria-label="Dismiss error" className="text-lg text-rose-500 hover:text-rose-800">×</button></div>}

        <footer className="relative z-10 shrink-0 border-t border-slate-200/80 bg-white/95 px-3 pb-3 pt-4 backdrop-blur-xl sm:px-6 sm:pt-5">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{attachments.map((item, index) => <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl border border-sky-200 bg-[#f3faff] p-2">{item.previewUrl ? <img src={item.previewUrl} alt={item.file.name} className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-slate-500">{getFileIcon(item.file)}</span>}<div className="min-w-0"><p className="max-w-40 truncate text-xs text-slate-700">{item.file.name}</p><p className="text-[10px] text-slate-400">{formatSize(item.file.size)}</p></div><button type="button" disabled={loading} onClick={() => removeFile(index)} aria-label={`Remove ${item.file.name}`} className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-sky-100 hover:text-slate-700 disabled:opacity-40">×</button></div>)}</div>}

            <form onSubmit={event => handleSend(event)} onDragOver={event => { event.preventDefault(); if (!loading) setDragActive(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDrop={event => { event.preventDefault(); setDragActive(false); if (!loading) addFiles(event.dataTransfer.files); }} className={`relative rounded-[26px] border bg-white shadow-[0_10px_38px_rgba(39,83,112,0.08)] transition focus-within:border-sky-300 ${dragActive ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}>
              {dragActive && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[26px] bg-white/95 text-sm font-semibold text-sky-800">Drop files to attach</div>}
              <textarea ref={inputRef} value={inputValue} onChange={event => setInputValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSend(event); } }} placeholder="Ask anything, or attach a file..." rows={2} maxLength={10000} disabled={loading} className="block max-h-36 min-h-[68px] w-full resize-y bg-transparent px-4 pb-2 pt-4 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50 sm:px-5" />
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml,.sql,.sh,.log,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg" className="hidden" onChange={event => addFiles(event.target.files)} />
              <div className="flex items-center justify-between gap-3 px-3 pb-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2"><button type="button" disabled={loading || attachments.length >= MAX_FILES} onClick={() => fileInputRef.current?.click()} className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-40" title="Attach files"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg><span className="hidden sm:inline">Attach</span>{attachments.length > 0 && <span>{attachments.length}</span>}</button><span className="hidden truncate text-[10px] text-slate-400 sm:inline">{loading ? "AI models are thinking..." : "10 files max · 10 MB each"}</span></div>
                <button type="submit" disabled={(!inputValue.trim() && attachments.length === 0) || loading} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#173b52] px-5 text-xs font-semibold text-white transition hover:bg-[#245773] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 19V5m-7 7 7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}<span>{loading ? "Working" : "Run battle"}</span></button>
              </div>
            </form>
            <p className="mt-3 text-center text-[10px] leading-4 text-slate-400 sm:text-[11px]">Groq · Cohere · OpenRouter Judge <span className="mx-2 text-slate-300">•</span> Chat history is saved in this browser</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
