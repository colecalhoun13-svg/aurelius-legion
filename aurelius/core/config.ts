// aurelius/core/config.ts

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

export const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  ENV: process.env.NODE_ENV || "development",
};
