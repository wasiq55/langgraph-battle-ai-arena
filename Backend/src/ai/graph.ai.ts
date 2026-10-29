
import {
  StateGraph,
  StateSchema,
  START,
  END
} from "@langchain/langgraph";
import { z } from "zod";
import {
  SystemMessage,
  HumanMessage
} from "@langchain/core/messages";
import {
  groqModel,
  cohereModel,
  judgeModel
} from "./model.ai.js";

const judgeSchema = z.object({
  solution_1_score: z.coerce.number().min(0).max(10),
  solution_2_score: z.coerce.number().min(0).max(10),
  solution_1_reasoning: z.string().min(1),
  solution_2_reasoning: z.string().min(1)
});

const state = new StateSchema({
  problem: z.string().default(""),
  solution_1: z.string().default(""),
  solution_2: z.string().default(""),
  judge: z.object({
    solution_1_score: z.number().default(0),
    solution_2_score: z.number().default(0),
    solution_1_reasoning: z.string().default(""),
    solution_2_reasoning: z.string().default("")
  })
});

const systemPrompt = `
You are a helpful, intelligent, friendly AI assistant.

UNDERSTAND THE USER:
- Understand Indian English, Hindi, Hinglish, and Hindi written in Roman letters.
- Understand informal language, spelling mistakes, grammar mistakes,
  abbreviations, short messages, and incomplete sentences.
- Focus on what the user means, not on correcting their grammar.
- Understand common Indian expressions naturally.
- Use available conversation context when it is provided.
- If the user's meaning is reasonably clear, answer directly.

HOW TO RESPOND:
- Speak naturally, like a helpful and knowledgeable person.
- Use simple, clear, human-friendly language.
- If the user writes in Hinglish, respond naturally in Hinglish.
- If the user writes in Hindi, respond in Hindi.
- If the user writes in English, use easy, clear English.
- Do not force Hindi, slang, or words like bhai into every answer.
- Explain difficult concepts with relatable examples when useful.
- For programming questions, give accurate solutions and clear steps.
- For simple questions, answer briefly.
- For complex questions, explain thoroughly and logically.
- Avoid unnecessary clarification questions, repetitive introductions,
  and generic disclaimers.
- If essential information is missing, ask a short, relevant question.

ACCURACY:
- Do not invent facts or claim access to information or tools you do not have.
- Be honest about uncertainty and limitations.
- Do not assume that every question is about India.
- Answer the actual question rather than giving unrelated suggestions.

Your goal is to understand the user's intention and provide the
most useful, natural, and easy-to-understand answer.
`;

function getText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") return part;
        return typeof part?.text === "string" ? part.text : "";
      })
      .join("");
  }

  return content == null ? "" : String(content);
}

function createMessages(problem) {
  return [
    new SystemMessage(systemPrompt),
    new HumanMessage(problem)
  ];
}

function createJudgePrompt(problem, solution_1, solution_2) {
  return `
You are an impartial AI judge evaluating two AI-generated answers.

Evaluate both answers fairly based on:
1. Correctness and factual accuracy
2. Relevance to the user's actual intention
3. Completeness
4. Clarity and ease of understanding
5. Natural, friendly communication
6. Appropriate handling of the user's language and context

Important evaluation rules:
- Understand the original question even if it contains spelling or grammar mistakes.
- Do not reward an answer merely because it is longer.
- Do not reward unnecessary clarification questions when the question is clear.
- Do not penalize natural Hinglish or informal language when appropriate.
- Prefer the answer that is more useful, accurate, relevant, and understandable.
- Do not prefer one model simply because of its name.
- Evaluate both answers independently.
- Score each answer from 0 to 10.
- Provide specific reasoning for both scores.
- Return all four required fields.
- Never leave a score or explanation empty.

Problem:
${problem}

Solution 1 (Groq):
${solution_1}

Solution 2 (Cohere):
${solution_2}
`;
}

async function evaluateJudge(problem, solution_1, solution_2) {
  const judge = judgeModel.withStructuredOutput(judgeSchema);
  const prompt = createJudgePrompt(
    problem,
    solution_1,
    solution_2
  );

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await judge.invoke(
        attempt === 1
          ? prompt
          : `${prompt}

Your previous response failed validation.
Return both scores as numbers from 0 to 10 and provide
non-empty explanations for both solutions.`
      );

      const validated = judgeSchema.safeParse(response);

      if (!validated.success) {
        throw new Error(
          `Invalid judge response: ${validated.error.message}`
        );
      }

      return validated.data;
    } catch (error) {
      lastError = error;
      console.error(`Judge attempt ${attempt} failed:`, error);
    }
  }

  throw new Error(
    `Judge failed after 3 attempts: ${
      lastError instanceof Error
        ? lastError.message
        : "Unknown judge error"
    }`
  );
}

const solutionNode = async graphState => {
  const messages = createMessages(graphState.problem);

  const [groqResponse, cohereResponse] = await Promise.all([
    groqModel.invoke(messages),
    cohereModel.invoke(messages)
  ]);

  const solution_1 = getText(groqResponse.content);
  const solution_2 = getText(cohereResponse.content);

  if (!solution_1.trim()) {
    throw new Error("Groq returned an empty response.");
  }

  if (!solution_2.trim()) {
    throw new Error("Cohere returned an empty response.");
  }

  return {
    solution_1,
    solution_2
  };
};

const judgeNode = async graphState => {
  const judge = await evaluateJudge(
    graphState.problem,
    graphState.solution_1,
    graphState.solution_2
  );

  return { judge };
};

const graph = new StateGraph(state)
  .addNode("solution", solutionNode)
  .addNode("judge_node", judgeNode)
  .addEdge(START, "solution")
  .addEdge("solution", "judge_node")
  .addEdge("judge_node", END)
  .compile();

export default async function runGraph(problem) {
  return await graph.invoke({ problem });
}

export async function runGraphStream(problem, emit) {
  let solution_1 = "";
  let solution_2 = "";

  async function streamSolution(model, solutionKey) {
    let answer = "";
    const messages = createMessages(problem);
    const stream = await model.stream(messages);

    for await (const chunk of stream) {
      const text = getText(chunk.content);

      if (!text) continue;

      answer += text;

      emit({
        type: "delta",
        solution: solutionKey,
        text
      });
    }

    if (!answer.trim()) {
      throw new Error(
        `${solutionKey} returned an empty response.`
      );
    }

    emit({
      type: "solution_done",
      solution: solutionKey
    });

    return answer;
  }

  try {
    emit({ type: "started" });

    [solution_1, solution_2] = await Promise.all([
      streamSolution(groqModel, "solution_1"),
      streamSolution(cohereModel, "solution_2")
    ]);

    emit({
      type: "solutions_done",
      solution_1,
      solution_2
    });

    const judge = await evaluateJudge(
      problem,
      solution_1,
      solution_2
    );

    const result = {
      solution_1,
      solution_2,
      judge
    };

    emit({
      type: "judge",
      judge
    });

    emit({
      type: "complete",
      result
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("Graph streaming failed:", error);

    emit({
      type: "error",
      message
    });

    throw error;
  }
}
