
import { ChatGroq } from "@langchain/groq";
import { ChatCohere } from "@langchain/cohere";
import { ChatOpenAI } from "@langchain/openai";
import config from "../config/config.js";

export const groqModel = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: config.GROQ_API_KEY,
});

export const cohereModel = new ChatCohere({
  model: "command-a-03-2025",
  apiKey: config.COHERE_API_KEY,
});

export const judgeModel = new ChatOpenAI({
  model: "openai/gpt-oss-120b",
  apiKey: config.OPENROUTER_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});
