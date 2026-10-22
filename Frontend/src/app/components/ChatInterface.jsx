// import React, { useState, useRef, useEffect } from 'react';
// import UserMessage from './UserMessage';
// import ArenaResponse from './ArenaResponse';
// import axios from "axios";

// const MOCK_RESPONSE = {
//   solution_1: "Here is a clean Python solution using modern syntax:\n\n```python\ndef fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n```\n\nThis approach has O(n) time complexity and O(1) space.",
//   solution_2: "A recursive solution can be elegant but less efficient:\n\n```python\ndef fib(n):\n    if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)\n```\n\nNote: this has O(2^n) time complexity.",
//   judge: {
//     solution_1_score: 10,
//     solution_2_score: 5,
//     solution_1_reasoning: "Excellent, optimal solution. Space complexity is O(1) which is perfect for this problem.",
//     solution_2_reasoning: "The recursive approach without memoization is extremely slow for large inputs."
//   }
// };

// export default function ChatInterface() {
//   const [messages, setMessages] = useState([]);
//   const [inputValue, setInputValue] = useState('');
//   const endOfMessagesRef = useRef(null);

//   const scrollToBottom = () => {
//     endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);


//   const handleSend = async (e) => {
//     e.preventDefault();

//     if (!inputValue.trim()) return;

//     try {
//       const response = await axios.post("http://localhost:3000/invoke", {
//         input: inputValue
//       });

//       const data = response.data;

//       const newMessage = {
//         id: Date.now(),
//         problem: inputValue,
//         ...data.result
//       };

//       setMessages((previousMessages) => [...previousMessages, newMessage]);
//       setInputValue('');
//     } catch (error) {
//       console.error("API request failed:", error.response?.data || error.message);
//     }
//   };


//   return (
//     <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
//       <header className="py-4 px-8 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 flex justify-center">
//         <h1 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">AI Chat Arena</h1>
//       </header>

//       <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 w-full max-w-6xl mx-auto flex flex-col">
//         {messages.length === 0 ? (
//           <div className="flex-1 flex items-center justify-center text-zinc-400">
//             <div className="text-center">
//               <h2 className="text-2xl font-light mb-2 text-zinc-600 dark:text-zinc-300">Welcome to the Arena</h2>
//               <p>Type a problem below to see two AI solutions go head-to-head.</p>
//             </div>
//           </div>
//         ) : (
//           messages.map((msg) => (
//             <div key={msg.id} className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
//               <UserMessage message={msg.problem} />
//               <ArenaResponse
//                 solution1={msg.solution_1}
//                 solution2={msg.solution_2}
//                 judge={msg.judge}
//               />
//             </div>
//           ))
//         )}
//         <div ref={endOfMessagesRef} />
//       </main>

//       <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
//         <div className="max-w-4xl mx-auto">
//           <form onSubmit={handleSend} className="relative flex items-center">
//             <input
//               type="text"
//               value={inputValue}
//               onChange={(e) => setInputValue(e.target.value)}
//               placeholder="Ask a coding question..."
//               className="w-full bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-none rounded-full py-4 pl-6 pr-16 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-zinc-400 transition-shadow shadow-sm hover:shadow-md text-lg"
//             />
//             <button
//               type="submit"
//               className="absolute right-2 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
//               disabled={!inputValue.trim()}
//             >
//               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
//                 <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
//               </svg>
//             </button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }


import React, { useState, useRef, useEffect } from "react";
import UserMessage from "./UserMessage";
import ArenaResponse from "./ArenaResponse";
import axios from "axios";

const suggestions = [
  {
    title: "Solve a coding problem",
    description: "Find the most efficient solution to a DSA problem.",
    prompt: "Explain binary search and implement it in JavaScript.",
    icon: "⌘",
  },
  {
    title: "Compare algorithms",
    description: "Compare approaches, complexity, and trade-offs.",
    prompt: "Compare merge sort and quicksort with time and space complexity.",
    icon: "⇄",
  },
  {
    title: "Debug my code",
    description: "Find bugs and suggest a better implementation.",
    prompt: "Explain common causes of memory leaks in JavaScript and how to fix them.",
    icon: "⌁",
  },
  {
    title: "Explore AI and ML",
    description: "Understand concepts with practical examples.",
    prompt: "Explain overfitting and underfitting with practical machine learning examples.",
    icon: "✳",
  },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  const handleSend = async (event, suggestedPrompt) => {
    event?.preventDefault();

    const problem = (suggestedPrompt ?? inputValue).trim();

    if (!problem || loading) return;

    setLoading(true);
    setErrorMessage("");
    setInputValue("");

    const messageId = Date.now();

    setMessages((previous) => [
      ...previous,
      {
        id: messageId,
        problem,
        status: "loading",
      },
    ]);

    try {
      const response = await axios.post(
        "http://localhost:3000/invoke",
        { input: problem },
        { timeout: 120000 }
      );

      const result = response.data?.result;

      if (
        !result ||
        result.solution_1 == null ||
        result.solution_2 == null ||
        !result.judge
      ) {
        throw new Error(
          "The server returned an incomplete response. Please try again."
        );
      }

      setMessages((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? {
                id: messageId,
                problem,
                solution_1: result.solution_1,
                solution_2: result.solution_2,
                judge: result.judge,
                status: "complete",
              }
            : message
        )
      );
    } catch (error) {
      console.error(
        "Arena request failed:",
        error.response?.data || error.message
      );

      const serverMessage =
        error.response?.data?.message ||
        error.response?.data?.error;

      const message =
        serverMessage ||
        (error.code === "ECONNABORTED"
          ? "The AI models are taking too long. Please try again."
          : error.code === "ERR_NETWORK"
            ? "Cannot connect to the backend. Make sure your server is running on port 3000."
            : error.message === "Network Error"
              ? "Connection failed. Check that the backend is running."
              : error.message ||
                "Something went wrong. Please try again.");

      setMessages((previous) =>
        previous.filter((item) => item.id !== messageId)
      );
      setErrorMessage(message);
      setInputValue(problem);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    if (loading) return;
    setMessages([]);
    setErrorMessage("");
    setInputValue("");
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#08090c] font-sans text-zinc-100 selection:bg-violet-500/30">
      <header className="relative z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0b0c10]/90 px-4 backdrop-blur-xl sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.12)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-6 w-6"
            >
              <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-white sm:text-base">
              Battle<span className="text-violet-400">Arena</span>
            </h1>
            <p className="hidden text-[10px] tracking-[0.16em] text-zinc-500 sm:block">
              MULTI-MODEL INTELLIGENCE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs text-zinc-400">Arena ready</span>
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty || loading}
            className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            New chat
          </button>

          <div className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-indigo-500/10 text-xs font-semibold text-violet-200 md:flex">
            AI
          </div>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="pointer-events-none fixed left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/[0.07] blur-[120px]" />

        {isEmpty ? (
          <section className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-10 sm:px-8 sm:py-14">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-7 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.07] px-3.5 py-2 text-[11px] font-medium tracking-wide text-violet-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  TWO MODELS. ONE WINNER.
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-4xl font-semibold leading-[1.13] tracking-[-0.045em] text-white sm:text-6xl">
                  Let the models
                  <br />
                  <span className="bg-gradient-to-r from-violet-300 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
                    battle it out.
                  </span>
                </h2>

                <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">
                  One problem. Two AI solutions. An independent judge.
                  Discover which answer delivers the best results.
                </p>
              </div>

              <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-center sm:p-4">
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-400/10 text-sm font-bold text-orange-300">
                    G
                  </div>
                  <p className="text-xs font-semibold text-zinc-200 sm:text-sm">Groq</p>
                  <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Solution 01</p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-center sm:p-4">
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-sm font-bold text-sky-300">
                    C
                  </div>
                  <p className="text-xs font-semibold text-zinc-200 sm:text-sm">Cohere</p>
                  <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Solution 02</p>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-center sm:p-4">
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 text-sm font-bold text-violet-300">
                    J
                  </div>
                  <p className="text-xs font-semibold text-zinc-200 sm:text-sm">Judge AI</p>
                  <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Final verdict</p>
                </div>
              </div>

              <div className="mt-10">
                <p className="mb-3 text-xs font-medium text-zinc-500">
                  START WITH AN IDEA
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.title}
                      type="button"
                      onClick={() => handleSend(undefined, suggestion.prompt)}
                      className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-violet-500/[0.045] disabled:opacity-50"
                      disabled={loading}
                    >
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-lg text-violet-300 transition group-hover:border-violet-400/20 group-hover:bg-violet-400/10">
                        {suggestion.icon}
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">
                        {suggestion.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {suggestion.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-5xl">
              <div className="mb-8 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-violet-300">
                    BATTLE HISTORY
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
                    Your arena sessions
                  </h2>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs text-zinc-400">
                  {messages.filter((message) => message.status === "complete").length} completed
                </span>
              </div>

              {messages.map((message, index) => (
                <article key={message.id} className="mb-10">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-xs font-bold text-violet-300">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
                        YOUR CHALLENGE
                      </p>
                      <p className="mt-1 break-words text-sm font-medium leading-6 text-zinc-100">
                        {message.problem}
                      </p>
                    </div>
                  </div>

                  {message.status === "loading" ? (
                    <div className="ml-0 rounded-2xl border border-violet-400/15 bg-[#101116] p-5 sm:ml-11 sm:p-7">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                          <svg
                            className="h-5 w-5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeOpacity=".2"
                              strokeWidth="3"
                            />
                            <path
                              d="M21 12a9 9 0 0 0-9-9"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            The battle is underway
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Generating solutions and evaluating both responses...
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {[1, 2].map((item) => (
                          <div
                            key={item}
                            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                          >
                            <div className="mb-4 h-3 w-24 animate-pulse rounded bg-white/[0.08]" />
                            <div className="mb-2 h-2 w-full animate-pulse rounded bg-white/[0.05]" />
                            <div className="mb-2 h-2 w-4/5 animate-pulse rounded bg-white/[0.05]" />
                            <div className="h-2 w-3/5 animate-pulse rounded bg-white/[0.05]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="ml-0 sm:ml-11">
                      <ArenaResponse
                        solution1={message.solution_1}
                        solution2={message.solution_2}
                        judge={message.judge}
                      />
                    </div>
                  )}
                </article>
              ))}

              <div ref={endOfMessagesRef} />
            </div>
          </section>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="relative mx-auto mb-4 flex w-[calc(100%-2rem)] max-w-3xl items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-400/10 text-sm text-red-300">
              !
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-200">
                The battle could not be completed
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-red-200/70">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss error"
              className="text-lg leading-none text-red-200/60 hover:text-red-200"
            >
              ×
            </button>
          </div>
        )}

        <div ref={endOfMessagesRef} />
      </main>

      <footer className="relative z-10 shrink-0 border-t border-white/[0.07] bg-[#0b0c10]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl sm:px-6 sm:pt-5">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={(event) => handleSend(event)}
            className="group relative rounded-2xl border border-white/[0.1] bg-[#111218] transition focus-within:border-violet-400/40 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.06)]"
          >
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(event);
                }
              }}
              placeholder="Describe a problem for the AI models..."
              rows={2}
              maxLength={10000}
              disabled={loading}
              className="block max-h-36 min-h-[68px] w-full resize-y bg-transparent px-4 pb-2 pt-4 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50 sm:px-5"
            />

            <div className="flex items-center justify-between gap-3 px-3 pb-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-2 pl-1 text-[10px] text-zinc-500 sm:text-xs">
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12" strokeLinecap="round" />
                </svg>
                <span className="truncate">
                  {loading ? "AI models are thinking..." : "Enter to send · Shift + Enter for new line"}
                </span>
              </div>

              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-violet-500 px-4 text-xs font-semibold text-white shadow-[0_4px_18px_rgba(139,92,246,0.18)] transition hover:bg-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:shadow-none"
              >
                {loading ? (
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeOpacity=".25"
                      strokeWidth="3"
                    />
                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 19V5m-7 7 7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span>{loading ? "Working" : "Run battle"}</span>
              </button>
            </div>
          </form>

          <p className="mt-3 text-center text-[10px] leading-4 text-zinc-600 sm:text-[11px]">
            Powered by Groq · Cohere · OpenRouter Judge
            <span className="mx-2 text-zinc-700">•</span>
            AI responses may contain errors
          </p>
        </div>
      </footer>
    </div>
  );
}
