
import {
  StateGraph,
  StateSchema,
  START,
  END,
  type GraphNode,
} from "@langchain/langgraph";
import { z } from "zod";
import { groqModel, cohereModel, judgeModel } from "./model.ai.js";

const judgeSchema = z.object({
  solution_1_score: z.coerce.number().min(0).max(10),
  solution_2_score: z.coerce.number().min(0).max(10),
  solution_1_reasoning: z.string().min(1),
  solution_2_reasoning: z.string().min(1),
});

const state = new StateSchema({
  problem: z.string().default(""),
  solution_1: z.string().default(""),
  solution_2: z.string().default(""),
  judge: z.object({
    solution_1_score: z.number().default(0),
    solution_2_score: z.number().default(0),
    solution_1_reasoning: z.string().default(""),
    solution_2_reasoning: z.string().default(""),
  }),
});

const solutionNode: GraphNode<typeof state> = async (state) => {
  const [groqResponse, cohereResponse] = await Promise.all([
    groqModel.invoke(state.problem),
    cohereModel.invoke(state.problem),
  ]);

  return {
    solution_1: String(groqResponse.content),
    solution_2: String(cohereResponse.content),
  };
};

const judgeNode: GraphNode<typeof state> = async (state) => {
  const { problem, solution_1, solution_2 } = state;

  const judge = judgeModel.withStructuredOutput(judgeSchema);

  const prompt = `
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

  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const judgeResponse = await judge.invoke(
        attempt === 1
          ? prompt
          : `${prompt}

Your previous response failed validation.
Return both scores as numbers from 0 to 10 and provide non-empty explanations for both solutions.`
      );

      const validated = judgeSchema.safeParse(judgeResponse);

      if (!validated.success) {
        throw new Error(
          `Invalid judge response: ${validated.error.message}`
        );
      }

      return {
        judge: validated.data,
      };
    } catch (error) {
      lastError = error;
      console.error(`OpenRouter judge attempt ${attempt} failed:`, error);
    }
  }

  throw new Error(
    `OpenRouter judge failed after 3 attempts: ${
      lastError instanceof Error
        ? lastError.message
        : "Unknown judge error"
    }`
  );
};

const graph = new StateGraph(state)
  .addNode("solution", solutionNode)
  .addNode("judge_node", judgeNode)
  .addEdge(START, "solution")
  .addEdge("solution", "judge_node")
  .addEdge("judge_node", END)
  .compile();

export default async function runGraph(problem: string) {
  const result = await graph.invoke({ problem });
  return result;
}
