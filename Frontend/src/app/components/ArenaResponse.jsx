import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github.css";

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) return null;
  return score;
}

function MarkdownContent({ content }) {
  return (
    <div className="break-words text-sm leading-7 text-slate-600 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_a]:text-sky-700 [&_a]:underline [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-950 [&_pre]:p-4 [&_code]:font-mono [&_code]:text-[13px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            return (
              <code className={`rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-sky-800 ${className || ""}`} {...props}>
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a {...props} target="_blank" rel="noreferrer" className="text-sky-700 underline underline-offset-4 hover:text-sky-900">
                {children}
              </a>
            );
          }
        }}
      >
        {typeof content === "string" && content.trim() ? content : "No solution content was returned by this model."}
      </ReactMarkdown>
    </div>
  );
}

function ScoreCard({ title, score, reasoning, winner, tone }) {
  const percentage = score === null ? 0 : score * 10;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(41,75,102,0.045)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-400">Judge evaluation</p>
        </div>
        {winner && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-700">WINNER</span>}
      </div>
      <div className="mt-6 flex items-end gap-2">
        <span className={`text-4xl font-semibold tracking-tight ${score === null ? "text-slate-300" : tone}`}>{score === null ? "N/A" : score}</span>
        {score !== null && <span className="mb-1 text-sm text-slate-400">/ 10</span>}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-700 ${winner ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-400">JUDGE REASONING</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
          {reasoning || "The judge did not provide an explanation for this solution. Check the backend judge response and try again."}
        </p>
      </div>
    </div>
  );
}

export default function ArenaResponse({ solution1, solution2, judge }) {
  const evaluation = useMemo(() => {
    const score1 = normalizeScore(judge?.solution_1_score);
    const score2 = normalizeScore(judge?.solution_2_score);
    const reasoning1 = typeof judge?.solution_1_reasoning === "string" ? judge.solution_1_reasoning.trim() : "";
    const reasoning2 = typeof judge?.solution_2_reasoning === "string" ? judge.solution_2_reasoning.trim() : "";
    const complete = score1 !== null && score2 !== null && reasoning1.length > 0 && reasoning2.length > 0;
    let winner = null;
    if (complete && score1 > score2) winner = 1;
    if (complete && score2 > score1) winner = 2;
    if (complete && score1 === score2) winner = 0;
    return { score1, score2, reasoning1, reasoning2, complete, winner };
  }, [judge]);

  return (
    <div className="my-8 flex w-full flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[
          { title: "Groq", subtitle: "Solution 01", letter: "G", solution: solution1, tone: "orange" , won: evaluation.winner === 1},
          { title: "Cohere", subtitle: "Solution 02", letter: "C", solution: solution2, tone: "sky", won: evaluation.winner === 2}
        ].map(model => (
          <section key={model.title} className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_12px_40px_rgba(41,75,102,0.055)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold ${model.tone === "orange" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>{model.letter}</div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{model.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{model.subtitle}</p>
                </div>
              </div>
              {model.won && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Winner</span>}
            </div>
            <div className="p-5 sm:p-6"><MarkdownContent content={model.solution} /></div>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-3xl border border-sky-200/80 bg-[#f5fbff] shadow-[0_12px_40px_rgba(41,75,102,0.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-white text-xl text-sky-700">⚖</div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Judge verdict</h3>
              <p className="mt-1 text-xs text-slate-500">Independent comparison and scoring</p>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-wide ${evaluation.complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {evaluation.complete ? "EVALUATION COMPLETE" : "EVALUATION INCOMPLETE"}
          </span>
        </div>

        {!judge ? (
          <div className="p-6">
            <p className="text-sm font-medium text-slate-800">No judge result was received.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Check the backend logs for errors from the judge model and verify that the API returned the judge object.</p>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            {evaluation.complete && (
              <div className="mb-5 rounded-2xl border border-sky-100 bg-white p-4">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400">FINAL VERDICT</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{evaluation.winner === 0 ? "It's a tie." : `Solution ${evaluation.winner} wins!`}</p>
                <p className="mt-1 text-sm text-slate-500">{evaluation.winner === 0 ? `Both solutions scored ${evaluation.score1}/10.` : `Solution ${evaluation.winner} received the higher score based on the judge's evaluation.`}</p>
              </div>
            )}
            {!evaluation.complete && (
              <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">The judge response is missing information.</p>
                <p className="mt-1 text-xs leading-5 text-amber-800/80">Available scores and explanations are shown below. Missing values are marked instead of being treated as zero. Review your backend judge response if this happens repeatedly.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ScoreCard title="Solution 1 · Groq" score={evaluation.score1} reasoning={evaluation.reasoning1} tone="text-emerald-600" winner={evaluation.winner === 1} />
              <ScoreCard title="Solution 2 · Cohere" score={evaluation.score2} reasoning={evaluation.reasoning2} tone="text-sky-700" winner={evaluation.winner === 2} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
