
import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/atom-one-dark.css";

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const score = Number(value);

  if (!Number.isFinite(score) || score < 0 || score > 10) {
    return null;
  }

  return score;
}

function MarkdownContent({ content }) {
  return (
    <div className="break-words text-sm leading-7 text-zinc-300 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_a]:text-violet-300 [&_a]:underline [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/[0.08] [&_pre]:bg-[#08090c] [&_pre]:p-4 [&_code]:font-mono [&_code]:text-[13px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            return (
              <code
                className={`rounded-md bg-white/[0.06] px-1.5 py-0.5 text-violet-200 ${className || ""}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 underline underline-offset-4 hover:text-violet-200"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {typeof content === "string" && content.trim()
          ? content
          : "No solution content was returned by this model."}
      </ReactMarkdown>
    </div>
  );
}

function ScoreCard({ title, score, reasoning, color, winner }) {
  const percentage = score === null ? 0 : score * 10;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111218] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-zinc-500">Judge evaluation</p>
        </div>

        {winner && (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-300">
            WINNER
          </span>
        )}
      </div>

      <div className="mt-6 flex items-end gap-2">
        {score === null ? (
          <span className="text-3xl font-bold text-zinc-500">N/A</span>
        ) : (
          <>
            <span className={`text-4xl font-bold tracking-tight ${color}`}>
              {score}
            </span>
            <span className="mb-1 text-sm text-zinc-500">/ 10</span>
          </>
        )}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${score === null ? "bg-zinc-700" : color.includes("emerald") ? "bg-emerald-400" : "bg-violet-400"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-zinc-500">
          JUDGE REASONING
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">
          {typeof reasoning === "string" && reasoning.trim()
            ? reasoning
            : "The judge did not provide an explanation for this solution. Check the backend judge response and try again."}
        </p>
      </div>
    </div>
  );
}

export default function ArenaResponse({ solution1, solution2, judge }) {
  const evaluation = useMemo(() => {
    const score1 = normalizeScore(judge?.solution_1_score);
    const score2 = normalizeScore(judge?.solution_2_score);

    const reasoning1 =
      typeof judge?.solution_1_reasoning === "string"
        ? judge.solution_1_reasoning.trim()
        : "";

    const reasoning2 =
      typeof judge?.solution_2_reasoning === "string"
        ? judge.solution_2_reasoning.trim()
        : "";

    const complete =
      score1 !== null &&
      score2 !== null &&
      reasoning1.length > 0 &&
      reasoning2.length > 0;

    let winner = null;

    if (complete && score1 > score2) winner = 1;
    if (complete && score2 > score1) winner = 2;
    if (complete && score1 === score2) winner = 0;

    return {
      score1,
      score2,
      reasoning1,
      reasoning2,
      complete,
      winner,
    };
  }, [judge]);

  return (
    <div className="my-8 flex w-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0f14] shadow-lg shadow-black/10">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/15 bg-orange-400/10 text-sm font-bold text-orange-300">
                G
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Solution 1</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Generated by Groq</p>
              </div>
            </div>
            {evaluation.winner === 1 && (
              <span className="text-xs font-medium text-emerald-300">
                Winner
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <MarkdownContent content={solution1} />
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0f14] shadow-lg shadow-black/10">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10 text-sm font-bold text-sky-300">
                C
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Solution 2</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Generated by Cohere</p>
              </div>
            </div>
            {evaluation.winner === 2 && (
              <span className="text-xs font-medium text-emerald-300">
                Winner
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <MarkdownContent content={solution2} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-violet-400/15 bg-[#0e0f14]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-xl text-violet-300">
              ⚖
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Judge Recommendations
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Independent comparison and scoring
              </p>
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-wide ${
              evaluation.complete
                ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
                : "border-amber-400/20 bg-amber-400/[0.07] text-amber-300"
            }`}
          >
            {evaluation.complete ? "EVALUATION COMPLETE" : "EVALUATION INCOMPLETE"}
          </span>
        </div>

        {!judge ? (
          <div className="p-6">
            <p className="text-sm font-medium text-zinc-300">
              No judge result was received.
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Check the backend logs for errors from the judge model and verify
              that the API returned the judge object.
            </p>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            {evaluation.complete && (
              <div className="mb-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500">
                  FINAL VERDICT
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {evaluation.winner === 0
                    ? "It's a tie."
                    : `Solution ${evaluation.winner} wins!`}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {evaluation.winner === 0
                    ? `Both solutions scored ${evaluation.score1}/10.`
                    : `Solution ${evaluation.winner} received the higher score based on the judge's evaluation.`}
                </p>
              </div>
            )}

            {!evaluation.complete && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4"
              >
                <p className="text-sm font-medium text-amber-200">
                  The judge response is missing information.
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Available scores and explanations are shown below. Missing
                  values are marked instead of being treated as zero.
                  Review your backend judge response if this happens repeatedly.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ScoreCard
                title="Solution 1 · Groq"
                score={evaluation.score1}
                reasoning={evaluation.reasoning1}
                color="text-emerald-300"
                winner={evaluation.winner === 1}
              />

              <ScoreCard
                title="Solution 2 · Cohere"
                score={evaluation.score2}
                reasoning={evaluation.reasoning2}
                color="text-violet-300"
                winner={evaluation.winner === 2}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
