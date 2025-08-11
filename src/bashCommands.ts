import { executeTool } from "./tools.ts";
import { logger } from "./logger.ts";
import { Message } from "./config.ts";

export interface BashCommandResult {
  response: string;
  isAsync: boolean;
  asyncHandler: () => Promise<void>;
}

export class BashCommandHandler {
  constructor(
    private setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    private messages: Message[]
  ) {}

  handleCommand(command: string): BashCommandResult {
    const cmd = command.slice(1).trim();

    if (!cmd) {
      return {
        response: "❌ No bash command provided. Usage: !<command>",
        isAsync: false,
        asyncHandler: async () => {}
      };
    }

    const asyncHandler = async (): Promise<void> => {
      try {
        await logger.info("Executing bash command", { command: cmd });
        const result = await executeTool({
          name: "run_command",
          arguments: { command: cmd }
        });

        const outputMessage: Message = {
          id: this.messages.length + 3,
          role: "assistant",
          content: `💻 Command: ${cmd}\n${result}`,
          timestamp: new Date(),
        };
        
        this.setMessages((prev: Message[]) => [...prev, outputMessage]);
        await logger.info("Bash command completed", { command: cmd, resultLength: result.length });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logger.error("Bash command failed", { command: cmd, error: errMsg });
        
        const outputMessage: Message = {
          id: this.messages.length + 3,
          role: "assistant",
          content: `❌ Error executing command "${cmd}": ${errMsg}`,
          timestamp: new Date(),
        };
        
        this.setMessages((prev: Message[]) => [...prev, outputMessage]);
      }
    };

    return {
      response: `🔧 Executing bash command: ${cmd}`,
      isAsync: true,
      asyncHandler
    };
  }
}