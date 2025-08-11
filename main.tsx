import React, { useState, useEffect } from "npm:react";
import { render, Box, Text, useInput } from "npm:ink";
import TextInput from "npm:ink-text-input@5";
import OpenAI from "npm:openai";
import process from "node:process";
import { mcpTools, executeTool } from "./tools.ts";
import { logger, LogLevel } from "./logger.ts";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function App() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exitPressCount, setExitPressCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Press Enter to send messages");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [currentModel, setCurrentModel] = useState<string>("gpt-5");
  const [isSlashCommand, setIsSlashCommand] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<string[]>([
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4o",
    "gpt-4o-mini", 
    "gpt-4",
    "gpt-4-turbo",
    "gpt-3.5-turbo"
  ]);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  
  const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
  });

  // Models that support function calling (tools)
  const functionCallingModels = [
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-4o',
    'gpt-4o-2024-08-06', 
    'gpt-4o-2024-05-13',
    'gpt-4o-mini',
    'gpt-4o-mini-2024-07-18',
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',
    'gpt-4-turbo-preview',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-4-0613',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo-0613'
  ];

  // Fetch available models from OpenAI API
  const fetchAvailableModels = async () => {
    try {
      await logger.info("Fetching available models from OpenAI API");
      const modelsList = await openai.models.list();
      const chatModels = modelsList.data
        .filter(model => functionCallingModels.includes(model.id))
        .map(model => model.id)
        .sort();
      
      if (chatModels.length > 0) {
        setAvailableModels(chatModels);
        setModelsLoaded(true);
        await logger.info("Models loaded from OpenAI API", { count: chatModels.length, models: chatModels });
      } else {
        // Fallback to known function calling models
        const fallbackModels = functionCallingModels.slice(0, 7);
        setAvailableModels(fallbackModels); 
        setModelsLoaded(true);
        await logger.warn("No models found in API response, using fallback", { fallbackModels });
      }
    } catch (error) {
      await logger.error("Could not fetch models from OpenAI API, using defaults", { error });
      const fallbackModels = functionCallingModels.slice(0, 7);
      setAvailableModels(fallbackModels);
      setModelsLoaded(true);
    }
  };

  // Load system prompt from file
  useEffect(() => {
    const loadSystemPrompt = async () => {
      try {
        const prompt = await Deno.readTextFile("prompt.txt");
        setSystemPrompt(prompt);
        await logger.info("System prompt loaded from prompt.txt", { length: prompt.length });
      } catch (error) {
        await logger.warn("Could not load prompt.txt, using default prompt", { error });
        setSystemPrompt("You are a helpful assistant with access to tools for file operations, directory listing, and shell commands. Use tools when the user asks for file operations or system tasks.");
      }
    };
    
    const initializeApp = async () => {
      await logger.info("AI CLI application starting", { model: currentModel });
      await loadSystemPrompt();
      await fetchAvailableModels();
    };
    
    initializeApp();
  }, []);

  // Timer effect for response duration
  useEffect(() => {
    let interval: number;
    if (isLoading && responseStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - responseStartTime);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, responseStartTime]);

  // Update slash command mode based on input
  useEffect(() => {
    setIsSlashCommand(input.startsWith('/'));
  }, [input]);

  useInput((input, key) => {
    // Handle up arrow for command history
    if (key.upArrow && !isLoading) {
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
      return;
    }
    
    // Handle down arrow for command history
    if (key.downArrow && !isLoading) {
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'c') {
      setInput("")
      setExitPressCount((prev: number) => prev + 1);
      if (exitPressCount === 0 || exitPressCount === 1) {
        setStatusMessage("Press Ctrl+C again to exit");
      } else {
        process.exit(0);
      }
    } else if (key.escape) {
      setExitPressCount((prev: number) => prev + 1);
      if (exitPressCount === 0) {
        setStatusMessage("Press Escape again to exit");
      } else {
        process.exit(0);
      }
    } else if (exitPressCount > 0) {
      setExitPressCount(0);
      setStatusMessage("Press Enter to send messages");
    }
  });

  useEffect(() => {
    if (exitPressCount > 0) {
      const timer = setTimeout(() => {
        setExitPressCount(0);
        setStatusMessage("Press Enter to send messages");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [exitPressCount]);

  // Handle slash commands
  const handleSlashCommand = (command: string): string => {
    const parts = command.slice(1).trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'model':
      case 'm':
        if (args.length === 0) {
          const loadingStatus = modelsLoaded ? '' : ' (loading...)';
          return `Current model: ${currentModel}\nAvailable models${loadingStatus}: ${availableModels.join(', ')}`;
        }
        const newModel = args[0];
        if (availableModels.includes(newModel)) {
          setCurrentModel(newModel);
          logger.info("Model switched via slash command", { from: currentModel, to: newModel });
          return `✅ Switched to model: ${newModel}`;
        } else {
          const loadingStatus = modelsLoaded ? '' : ' (still loading...)';
          return `❌ Unknown model: ${newModel}\nAvailable models${loadingStatus}: ${availableModels.join(', ')}`;
        }
      
      case 'models':
        fetchAvailableModels();
        return `🔄 Refreshing model list from OpenAI API...`;

      case 'logs':
        const lines = args.length > 0 ? parseInt(args[0]) : 20;
        logger.readLog(lines).then(logContent => {
          const logMessage: Message = {
            id: messages.length + 3,
            role: "assistant",
            content: `📝 Recent log entries:\n\`\`\`\n${logContent}\n\`\`\``,
            timestamp: new Date(),
          };
          setMessages((prev: Message[]) => [...prev, logMessage]);
        });
        return `📖 Reading last ${lines} log entries...`;

      case 'clearlogs':
        logger.clearLog();
        return `🗑️ Log file cleared`;

      case 'loglevel':
        if (args.length === 0) {
          const currentLevel = LogLevel[logger.getLogLevel()];
          return `Current log level: ${currentLevel}\nAvailable levels: DEBUG, INFO, WARN, ERROR`;
        }
        const levelName = args[0].toUpperCase();
        const level = LogLevel[levelName as keyof typeof LogLevel];
        if (level !== undefined) {
          logger.setLogLevel(level);
          return `✅ Log level set to: ${levelName}`;
        } else {
          return `❌ Invalid log level. Available: DEBUG, INFO, WARN, ERROR`;
        }

      case 'help':
      case 'h':
        return `Available slash commands:
/model [name] or /m [name] - Switch LLM model
/models - Refresh model list from OpenAI API
/logs [lines] - View recent log entries (default: 20 lines)
/clearlogs - Clear the log file
/loglevel [level] - Set/view log level (DEBUG, INFO, WARN, ERROR)
/help or /h - Show this help message

Note: Only models that support function calling (tools) are shown, as this app uses MCP tools for file operations.

Examples:
/model gpt-4o-mini
/m gpt-4-turbo
/models
/logs 50
/loglevel DEBUG`;

      default:
        return `❌ Unknown command: /${cmd}\nType /help for available commands.`;
    }
  };

  // Recursive function to handle tool calls until finished
  const handleToolCallsRecursively = async (message: any, conversationMessages: any[], depth = 0): Promise<void> => {
    const maxDepth = 10; // Prevent infinite recursion
    
    if (depth >= maxDepth) {
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

    // Add the assistant message with tool calls to conversation
    conversationMessages.push({
      role: "assistant",
      content: message.content,
      tool_calls: message.tool_calls
    });

    let conversationFinished = false;
    let finishedSummary = "";

    // Execute all tool calls
    for (const toolCall of message.tool_calls) {
      if (toolCall.function) {
        await logger.info("Executing MCP tool (recursive)", { 
          toolName: toolCall.function.name, 
          arguments: toolCall.function.arguments,
          depth
        });
        
        const result = await executeTool({
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        });
        
        // Check for finished signal
        if (result.startsWith("CONVERSATION_COMPLETE:")) {
          conversationFinished = true;
          finishedSummary = result.replace("CONVERSATION_COMPLETE:", "");
          await logger.info("Conversation finished by LLM (recursive)", { summary: finishedSummary, depth });
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
        finishedSummary 
      });
      
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: message.content || `Task completed: ${finishedSummary}`,
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
      await logger.info("Recursive conversation completed, returning control to user");
      return;
    }

    // Get LLM's response to the tool results
    await logger.info("Getting LLM follow-up response (recursive)", { depth });
    
    const followUpCompletion = await openai.chat.completions.create({
      model: currentModel,
      messages: conversationMessages,
      max_completion_tokens: 10000,
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
      await handleToolCallsRecursively(nextMessage, conversationMessages, depth + 1);
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
  };

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isLoading) return;

    // Add to command history
    const trimmedValue = value.trim();
    setCommandHistory((prev: string[]) => [...prev, trimmedValue]);
    setHistoryIndex(-1);

    const userMessage: Message = {
      id: messages.length + 1,
      role: "user", 
      content: trimmedValue,
      timestamp: new Date(),
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput("");

    // Handle slash commands
    if (trimmedValue.startsWith('/')) {
      const response = handleSlashCommand(trimmedValue);
      const systemMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev: Message[]) => [...prev, systemMessage]);
      return;
    }

    setIsLoading(true);
    setResponseStartTime(Date.now());
    setElapsedTime(0);

    await logger.info("Starting OpenAI chat completion", { 
      model: currentModel, 
      userInput: trimmedValue,
      messageCount: messages.length 
    });

    try {
      const completion = await openai.chat.completions.create({
        model: currentModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((msg: Message) => ({ 
            role: msg.role, 
            content: msg.content 
          })),
          { role: "user", content: value.trim() }
        ],
        max_completion_tokens: 10000,
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
        // Build messages with tool calls and results
        const conversationMessages = [
          { role: "system", content: systemPrompt },
          ...messages.map((msg: Message) => ({ 
            role: msg.role, 
            content: msg.content 
          })),
          { role: "user", content: trimmedValue },
          { role: "assistant", content: message.content, tool_calls: message.tool_calls }
        ];
        
        // Execute all tool calls and check for finished signal
        let conversationFinished = false;
        let finishedSummary = "";
        
        for (const toolCall of message.tool_calls) {
          if (toolCall.function) {
            await logger.info("Executing MCP tool", { 
              toolName: toolCall.function.name, 
              arguments: toolCall.function.arguments 
            });
            
            const result = await executeTool({
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments)
            });
            
            await logger.debug("MCP tool result", { 
              toolName: toolCall.function.name, 
              resultLength: result.length 
            });
            
            // Check for finished signal
            if (result.startsWith("CONVERSATION_COMPLETE:")) {
              conversationFinished = true;
              finishedSummary = result.replace("CONVERSATION_COMPLETE:", "");
              await logger.info("Conversation finished by LLM", { summary: finishedSummary });
            }
            
            // Add tool result to conversation
            conversationMessages.push({
              role: "tool",
              content: result,
              tool_call_id: toolCall.id
            });
          }
        }
        
        // If conversation is finished, don't make another API call
        if (conversationFinished) {
          await logger.info("Initial conversation finished - message content", { 
            messageContent: message.content,
            messageContentLength: message.content?.length || 0,
            finishedSummary 
          });
          
          const assistantMessage: Message = {
            id: messages.length + 2,
            role: "assistant",
            content: message.content || finishedSummary,
            timestamp: new Date(),
          };
          
          setMessages((prev: Message[]) => [...prev, assistantMessage]);
          await logger.info("Conversation completed, returning control to user");
        } else {
          // Get LLM's response to the tool results
          await logger.info("Getting LLM follow-up response to tool results");
          
          const followUpCompletion = await openai.chat.completions.create({
            model: currentModel,
            messages: conversationMessages,
            max_completion_tokens: 10000,
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
          
          const finalMessage = followUpCompletion.choices[0]?.message;
          
          // Handle recursive tool calls
          if (finalMessage?.tool_calls) {
            await logger.info("LLM made additional tool calls, continuing execution", { 
              toolCount: finalMessage.tool_calls.length 
            });
            
            // Continue recursively executing tools
            await handleToolCallsRecursively(finalMessage, conversationMessages);
          } else {
            const assistantMessage: Message = {
              id: messages.length + 2,
              role: "assistant",
              content: finalMessage?.content || "I executed the tools but couldn't provide a response.",
              timestamp: new Date(),
            };
            
            setMessages((prev: Message[]) => [...prev, assistantMessage]);
          }
        }
        
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
    } catch (error) {
      await logger.error("OpenAI API call failed", { 
        error: error instanceof Error ? error.message : String(error),
        model: currentModel,
        userInput: trimmedValue
      });
      
      const errorMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setResponseStartTime(null);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box
        flexDirection="column"
        flexGrow={1}
      >
        <Box flexDirection="column" flexGrow={1}>
          {messages.map((message: Message) => (
            <Box key={message.id} marginBottom={1}>
              <Text color={message.role === "user" ? "green" : "cyan"} bold>
                {message.role === "user" ? "You" : "AI"}: 
              </Text>
              <Text> {message.content}</Text>
            </Box>
          ))}
          
          {isLoading && (
            <Box>
              <Text color="#ff9955" bold>AI: </Text>
              <Text color="#ff9955">
                Thinking... ({(elapsedTime / 1000).toFixed(1)}s)
              </Text>
            </Box>
          )}
        </Box>
      </Box>
      
      <Box
        borderStyle="bold"
        borderColor="#aa9988"
      >
        <Text color={isSlashCommand ? "#ffaa00" : "#ff9955"}> {isSlashCommand ? '/' : '>'} </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isSlashCommand ? "Enter slash command..." : "Type your message and press Enter..."}
        />
      </Box>
      
      <Box
        justifyContent="center"
      >
        <Text color="#aa9988" dimColor>
          {statusMessage}
        </Text>
      </Box>
    </Box>
  );
}

if (import.meta.main) {
  render(<App />);
}
