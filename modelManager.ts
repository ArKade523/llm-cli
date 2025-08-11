import OpenAI from "npm:openai";
import { FUNCTION_CALLING_MODELS } from "./config.ts";
import { logger } from "./logger.ts";

export class ModelManager {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });
  }

  async fetchAvailableModels(): Promise<string[]> {
    try {
      await logger.info("Fetching available models from OpenAI API");
      const modelsList = await this.openai.models.list();
      const chatModels = modelsList.data
        .filter(model => FUNCTION_CALLING_MODELS.includes(model.id))
        .map(model => model.id)
        .sort();
      
      if (chatModels.length > 0) {
        await logger.info("Models loaded from OpenAI API", { 
          count: chatModels.length, 
          models: chatModels 
        });
        return chatModels;
      } else {
        // Fallback to known function calling models
        const fallbackModels = FUNCTION_CALLING_MODELS.slice(0, 7);
        await logger.warn("No models found in API response, using fallback", { fallbackModels });
        return fallbackModels;
      }
    } catch (error) {
      await logger.error("Could not fetch models from OpenAI API, using defaults", { error });
      return FUNCTION_CALLING_MODELS.slice(0, 7);
    }
  }
}