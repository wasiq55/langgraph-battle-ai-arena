import React from "react";

export default function UserMessage({ message }) {
  return (
    <div className="my-7 flex w-full justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex max-w-[92%] flex-col items-end gap-2 sm:max-w-[78%]">
        <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          You
        </span>
        <div className="rounded-3xl rounded-tr-lg border border-sky-200/80 bg-[#e5f5ff] px-4 py-3.5 text-sm leading-7 text-slate-800 shadow-[0_8px_28px_rgba(63,133,171,0.08)] sm:px-5">
          <div className="whitespace-pre-wrap break-words">{message}</div>
        </div>
      </div>
    </div>
  );
}
