import React, { useState, useEffect } from "npm:react";
import { render, Box, Text, useInput } from "npm:ink";
import TextInput from "npm:ink-text-input@5";
import OpenAI from "npm:openai";
import process from "node:process";
import { mcpTools, executeTool } from "./tools.ts";

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
  
  const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
  });

  useInput((input, key) => {
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

    const userMessage: Message = {
      id: messages.length + 1,
      role: "user",
      content: value.trim(),
      timestamp: new Date(),
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: "You are a helpful assistant with access to tools for file operations, directory listing, and shell commands. Use tools when the user asks for file operations or system tasks." },
          ...messages.map((msg: Message) => ({ 
            role: msg.role, 
            content: msg.content 
          })),
          { role: "user", content: value.trim() }
        ],
        max_completion_tokens: 500,
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
      
      // Handle tool calls
      if (message?.tool_calls) {
        let toolResults = "";
        
        for (const toolCall of message.tool_calls) {
          if (toolCall.function) {
            const result = await executeTool({
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments)
            });
            toolResults += `\n\n🔧 ${toolCall.function.name}:\n${result}`;
          }
        }
        
        const assistantMessage: Message = {
          id: messages.length + 2,
          role: "assistant",
          content: (message.content || "") + toolResults,
          timestamp: new Date(),
        };
        
        setMessages((prev: Message[]) => [...prev, assistantMessage]);
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
      const errorMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
              <Text color="#ff9955">Thinking...</Text>
            </Box>
          )}
        </Box>
      </Box>
      
      <Box
        borderStyle="bold"
        borderColor="gray"
      >
        <Text color="#ff9955"> {'>'} </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type your message and press Enter..."
        />
      </Box>
      
      <Box
        justifyContent="center"
      >
        <Text color="gray" dimColor>
          {statusMessage}
        </Text>
      </Box>
    </Box>
  );
}

if (import.meta.main) {
  render(<App />);
}
