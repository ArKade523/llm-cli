import OpenAI from "npm:openai";
import { Message, APP_CONFIG } from "./config.ts";
import { mcpTools, executeTool } from "./tools.ts";
import { logger } from "./logger.ts";

export class OpenAIHandler {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });
  }

  async handleUserMessage(
    userInput: string,
    messages: Message[],
    systemPrompt: string,
    currentModel: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ): Promise<void> {
    await logger.info("Starting OpenAI chat completion", { 
      model: currentModel, 
      userInput,
      messageCount: messages.length 
    });

    const completion = await this.openai.chat.completions.create({
      model: currentModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((msg: Message) => ({ 
          role: msg.role, 
          content: msg.content 
        })),
        { role: "user", content: userInput }
      ],
      max_completion_tokens: APP_CONFIG.MAX_COMPLETION_TOKENS,
      tools: mcpTools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      })),
      tool_choice: "auto"
    });

    const message = completion.choices[0]?.message;
    
    // Handle tool calls - proper OpenAI function calling flow
    if (message?.tool_calls) {
      await this.handleToolCalls(message, messages, userInput, systemPrompt, currentModel, setMessages);
    } else {
      // Regular response without tools
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: message?.content || "Sorry, I couldn't process that request.",
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    }
  }

  private async handleToolCalls(
    message: any,
    messages: Message[],
    userInput: string,
    systemPrompt: string,
    currentModel: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    depth = 0
  ): Promise<void> {
    if (depth >= APP_CONFIG.MAX_RECURSION_DEPTH) {
      await logger.error("Max recursion depth reached, stopping tool execution", { depth });
      const errorMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: "I've reached the maximum number of tool calls. Please try breaking your request into smaller parts.",
        timestamp: new Date(),
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
      return;
    }

    // Build messages with tool calls and results
    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: Message) => ({ 
        role: msg.role, 
        content: msg.content 
      })),
      { role: "user", content: userInput },
      { role: "assistant", content: message.content, tool_calls: message.tool_calls }
    ];

    let conversationFinished = false;
    let finishedSummary = "";

    // Execute all tool calls
    for (const toolCall of message.tool_calls) {
      if (toolCall.function) {
        await logger.info("Executing MCP tool", { 
          toolName: toolCall.function.name, 
          arguments: toolCall.function.arguments,
          depth
        });
        
        const result = await executeTool({
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        });
        
        await logger.debug("MCP tool result", { 
          toolName: toolCall.function.name, 
          resultLength: result.length,
          depth
        });
        
        // Check for finished signal
        if (result.startsWith("CONVERSATION_COMPLETE:")) {
          conversationFinished = true;
          finishedSummary = result.replace("CONVERSATION_COMPLETE:", "");
          await logger.info("Conversation finished by LLM", { summary: finishedSummary, depth });
        }
        
        // Add tool result to conversation
        conversationMessages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id
        });
      }
    }

    // If conversation is finished, return final response
    if (conversationFinished) {
      await logger.info("Conversation finished - message content", { 
        messageContent: message.content,
        messageContentLength: message.content?.length || 0,
        finishedSummary,
        depth
      });
      
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: message.content || `Task completed: ${finishedSummary}`,
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
      await logger.info("Conversation completed, returning control to user");
      return;
    }

    // Get LLM's response to the tool results
    await logger.info("Getting LLM follow-up response to tool results", { depth });
    
    const followUpCompletion = await this.openai.chat.completions.create({
      model: currentModel,
      messages: conversationMessages,
      max_completion_tokens: APP_CONFIG.MAX_COMPLETION_TOKENS,
      tools: mcpTools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      })),
      tool_choice: "auto"
    });
    
    const nextMessage = followUpCompletion.choices[0]?.message;
    
    // Continue recursively if more tools are needed
    if (nextMessage?.tool_calls) {
      await logger.info("LLM made additional tool calls, continuing execution", { 
        toolCount: nextMessage.tool_calls.length,
        depth: depth + 1
      });
      
      await this.handleToolCalls(
        nextMessage,
        messages,
        userInput,
        systemPrompt,
        currentModel,
        setMessages,
        depth + 1
      );
    } else {
      // Final response
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: nextMessage?.content || "I completed the task but couldn't provide a final response.",
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    }
  }
}