
import {
  StateGraph,
  StateSchema,
  START,
  END
} from "@langchain/langgraph";
import { z } from "zod";
import { groqModel, cohereModel, judgeModel } from "./model.ai.js";

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

function createJudgePrompt(problem, solution_1, solution_2) {
  return `
You are an impartial AI judge evaluating two AI-generated solutions.

Evaluate both solutions based on:
1. Correctness and accuracy
2. Relevance to the problem
3. Completeness
4. Efficiency
5. Clarity

Give each solution a score from 0 to 10.
Provide a specific explanation for each score.
Return all four required fields.
Do not leave any score or explanation empty.
Judge both solutions independently and fairly.

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
  const prompt = createJudgePrompt(problem, solution_1, solution_2);
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await judge.invoke(
        attempt === 1
          ? prompt
          : `${prompt}

Your previous response failed validation.
Return both scores as numbers from 0 to 10 and provide non-empty explanations for both solutions.`
      );

      const validated = judgeSchema.safeParse(response);

      if (!validated.success) {
        throw new Error(`Invalid judge response: ${validated.error.message}`);
      }

      return validated.data;
    } catch (error) {
      lastError = error;
      console.error(`Judge attempt ${attempt} failed:`, error);
    }
  }

  throw new Error(
    `Judge failed after 3 attempts: ${
      lastError instanceof Error ? lastError.message : "Unknown judge error"
    }`
  );
}

const solutionNode = async graphState => {
  const [groqResponse, cohereResponse] = await Promise.all([
    groqModel.invoke(graphState.problem),
    cohereModel.invoke(graphState.problem)
  ]);

  return {
    solution_1: getText(groqResponse.content),
    solution_2: getText(cohereResponse.content)
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
    const stream = await model.stream(problem);

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

    emit({
      type: "solution_done",
      solution: solutionKey
    });

    return answer;
  }

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

  const judge = await evaluateJudge(problem, solution_1, solution_2);

  emit({
    type: "judge",
    judge
  });

  const result = {
    solution_1,
    solution_2,
    judge
  };

  emit({
    type: "complete",
    result
  });

  return result;
}
