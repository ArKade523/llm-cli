import React, { useState, useEffect } from "npm:react";
import { render, Box, Text, useInput } from "npm:ink";
import TextInput from "npm:ink-text-input@5";
import process from "node:process";

import { Message, DEFAULT_MODELS, APP_CONFIG } from "./config.ts";
import { logger } from "./logger.ts";
import { SlashCommandHandler } from "./slashCommands.ts";
import { BashCommandHandler } from "./bashCommands.ts";
import { ConfigCommandHandler } from "./configCommands.ts";
import { OpenAIHandler } from "./openaiHandler.ts";
import { ModelManager } from "./modelManager.ts";
import { configManager } from "./configManager.ts";

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
  const [currentModel, setCurrentModel] = useState<string>(APP_CONFIG.DEFAULT_MODEL);
  const [isSlashCommand, setIsSlashCommand] = useState<boolean>(false);
  const [isBashCommand, setIsBashCommand] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<string[]>(DEFAULT_MODELS);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<any>(null);
  
  // Initialize managers
  const modelManager = new ModelManager();
  const openaiHandler = new OpenAIHandler();
  
  const fetchAvailableModels = async (): Promise<void> => {
    const models = await modelManager.fetchAvailableModels();
    setAvailableModels(models);
    setModelsLoaded(true);
  };

  // Initialize command handlers
  const slashCommandHandler = new SlashCommandHandler(
    availableModels,
    modelsLoaded,
    currentModel,
    setCurrentModel,
    setMessages,
    messages,
    fetchAvailableModels
  );
  
  const bashCommandHandler = new BashCommandHandler(
    setMessages,
    messages
  );

  const configCommandHandler = new ConfigCommandHandler(
    setMessages,
    messages
  );

  // Load configuration and initialize app
  useEffect(() => {
    const initializeApp = async () => {
      await logger.info("AI CLI application starting");
      
      try {
        // Load configuration
        const config = await configManager.loadConfig();
        setCurrentModel(config.general.defaultModel);
        setCurrentTheme(configManager.getCurrentTheme());
        
        // Set up config change listener
        configManager.onConfigChange((newConfig) => {
          setCurrentModel(newConfig.general.defaultModel);
          setCurrentTheme(configManager.getCurrentTheme());
        });
        
        // Load system prompt from configured file
        try {
          const prompt = await Deno.readTextFile(config.files.systemPromptFile);
          setSystemPrompt(prompt);
          await logger.info("System prompt loaded from file", { length: prompt.length });
        } catch (error) {
          await logger.warn("Could not load system prompt file, using default", { error });
          setSystemPrompt(APP_CONFIG.DEFAULT_SYSTEM_PROMPT);
        }
        
        // Load available models from config
        const configModels = configManager.getAvailableModels();
        if (configModels.length > 0) {
          setAvailableModels(configModels);
          setModelsLoaded(true);
        } else {
          await fetchAvailableModels();
        }
        
      } catch (error) {
        await logger.error("Failed to initialize configuration", { error });
        // Fall back to default initialization
        setCurrentModel(APP_CONFIG.DEFAULT_MODEL);
        setSystemPrompt(APP_CONFIG.DEFAULT_SYSTEM_PROMPT);
        await fetchAvailableModels();
      }
    };
    
    initializeApp();
  }, []);

  // Timer effect for response duration
  useEffect(() => {
    let interval: number;
    if (isLoading && responseStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - responseStartTime);
      }, APP_CONFIG.TIMER_UPDATE_INTERVAL);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, responseStartTime]);

  // Update command modes based on input
  useEffect(() => {
    setIsSlashCommand(input.startsWith('/'));
    setIsBashCommand(input.startsWith('!'));
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
      // Check if it's a config command
      if (trimmedValue.startsWith('/config')) {
        const result = configCommandHandler.handleCommand(trimmedValue);
        const systemMessage: Message = {
          id: messages.length + 2,
          role: "assistant",
          content: result.response,
          timestamp: new Date(),
        };
        setMessages((prev: Message[]) => [...prev, systemMessage]);
        
        // Handle async operations
        if (result.isAsync && result.asyncHandler) {
          result.asyncHandler();
        }
        return;
      } else {
        // Handle other slash commands
        const result = slashCommandHandler.handleCommand(trimmedValue);
        const systemMessage: Message = {
          id: messages.length + 2,
          role: "assistant",
          content: result.response,
          timestamp: new Date(),
        };
        setMessages((prev: Message[]) => [...prev, systemMessage]);
        
        // Handle async operations
        if (result.isAsync && result.asyncHandler) {
          result.asyncHandler();
        }
        return;
      }
    } else if (trimmedValue.startsWith('!')) {
      const result = bashCommandHandler.handleCommand(trimmedValue);
      const systemMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };
      setMessages((prev: Message[]) => [...prev, systemMessage]);
      
      // Execute bash command asynchronously
      if (result.isAsync) {
        result.asyncHandler();
      }
      return;
    }
 
    setIsLoading(true);
    setResponseStartTime(Date.now());
    setElapsedTime(0);

    try {
      await openaiHandler.handleUserMessage(
        trimmedValue,
        messages,
        systemPrompt,
        currentModel,
        setMessages
      );
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
              <Text color={message.role === "user" ? (currentTheme?.userColor || "green") : (currentTheme?.assistantColor || "cyan")} bold>
                {message.role === "user" ? "You" : "AI"}: 
              </Text>
              <Text> {message.content}</Text>
            </Box>
          ))}
          
          {isLoading && (
            <Box>
              <Text color={currentTheme?.systemColor || "#ff9955"} bold>AI: </Text>
              <Text color={currentTheme?.systemColor || "#ff9955"}>
                Thinking... ({(elapsedTime / 1000).toFixed(1)}s)
              </Text>
            </Box>
          )}
        </Box>
      </Box>
      
      <Box
        borderStyle="bold"
        borderColor={currentTheme?.borderColor || "#aa9988"}
      >
        <Text color={currentTheme?.systemColor || "#ff9955"}> {isSlashCommand ? '/' : isBashCommand ? '!' : '>'} </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isSlashCommand ? "Enter slash command..." : 
            isBashCommand ? "Enter yor bash command..." : 
            "Type your message and press Enter..."}
        />
      </Box>
      
      <Box
        justifyContent="center"
      >
        <Text color={currentTheme?.dimColor || "#aa9988"} dimColor>
          {statusMessage}
        </Text>
      </Box>
    </Box>
  );
}

if (import.meta.main) {
  render(<App />);
}
