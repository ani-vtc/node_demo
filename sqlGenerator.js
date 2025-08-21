import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';

dotenv.config();

export class SQLGenerator {
  constructor() {
    this.llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-3-5-sonnet-20241022",
      temperature: 0,
    });
  }

  async generateSQL(textInput, databaseSchema = null) {
    try {
      const schemaContext = databaseSchema 
        ? `Database Schema:\n${JSON.stringify(databaseSchema, null, 1)}\n\n`
        : '';
      console.log("Schema context:", schemaContext);
      const prompt = ChatPromptTemplate.fromTemplate(`
You are an expert SQL query generator. Your task is to convert natural language text into valid MySQL SQL queries, for visualizing as a graph.

Instructions:
1. Generate a valid MySQL query based on the user's natural language request
2. Use proper MySQL syntax and conventions
3. Include appropriate WHERE clauses, JOINs, and other SQL constructs as needed
4. Return ONLY the SQL query without explanations or markdown formatting
5. Ensure the query is safe and follows best practices

User Request: {textInput}

SQL Query:`);

      const chain = prompt.pipe(this.llm);
      const response = await chain.invoke({
        textInput: textInput
      });

      return response.content.trim();
    } catch (error) {
      console.error('Error generating SQL:', error);
      throw new Error('Failed to generate SQL query');
    }
  }
}