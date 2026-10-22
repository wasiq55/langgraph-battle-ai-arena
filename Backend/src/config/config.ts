
import dotenv from "dotenv";

dotenv.config();

const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  COHERE_API_KEY: process.env.COHERE_API_KEY || "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
};

export default config;
