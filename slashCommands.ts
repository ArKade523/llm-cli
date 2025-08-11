import { logger, LogLevel } from "./logger.ts";
import { Message } from "./config.ts";

export interface SlashCommandResult {
  response: string;
  isAsync?: boolean;
  asyncHandler?: () => Promise<void>;
}

export class SlashCommandHandler {
  constructor(
    private availableModels: string[],
    private modelsLoaded: boolean,
    private currentModel: string,
    private setCurrentModel: (model: string) => void,
    private setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    private messages: Message[],
    private fetchAvailableModels: () => Promise<void>
  ) {}

  handleCommand(command: string): SlashCommandResult {
    const parts = command.slice(1).trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'model':
      case 'm':
        return this.handleModelCommand(args);
      
      case 'models':
        return this.handleModelsCommand();

      case 'logs':
        return this.handleLogsCommand(args);

      case 'clearlogs':
        return this.handleClearLogsCommand();

      case 'loglevel':
        return this.handleLogLevelCommand(args);

      case 'help':
      case 'h':
        return this.handleHelpCommand();

      default:
        return {
          response: `❌ Unknown command: /${cmd}\nType /help for available commands.`
        };
    }
  }

  private handleModelCommand(args: string[]): SlashCommandResult {
    if (args.length === 0) {
      const loadingStatus = this.modelsLoaded ? '' : ' (loading...)';
      return {
        response: `Current model: ${this.currentModel}\nAvailable models${loadingStatus}: ${this.availableModels.join(', ')}`
      };
    }

    const newModel = args[0];
    if (this.availableModels.includes(newModel)) {
      this.setCurrentModel(newModel);
      logger.info("Model switched via slash command", { from: this.currentModel, to: newModel });
      return {
        response: `✅ Switched to model: ${newModel}`
      };
    } else {
      const loadingStatus = this.modelsLoaded ? '' : ' (still loading...)';
      return {
        response: `❌ Unknown model: ${newModel}\nAvailable models${loadingStatus}: ${this.availableModels.join(', ')}`
      };
    }
  }

  private handleModelsCommand(): SlashCommandResult {
    return {
      response: `🔄 Refreshing model list from OpenAI API...`,
      isAsync: true,
      asyncHandler: this.fetchAvailableModels
    };
  }

  private handleLogsCommand(args: string[]): SlashCommandResult {
    const lines = args.length > 0 ? parseInt(args[0]) : 20;
    return {
      response: `📖 Reading last ${lines} log entries...`,
      isAsync: true,
      asyncHandler: async () => {
        const logContent = await logger.readLog(lines);
        const logMessage: Message = {
          id: this.messages.length + 3,
          role: "assistant",
          content: `📝 Recent log entries:\n\`\`\`\n${logContent}\n\`\`\``,
          timestamp: new Date(),
        };
        this.setMessages((prev: Message[]) => [...prev, logMessage]);
      }
    };
  }

  private handleClearLogsCommand(): SlashCommandResult {
    logger.clearLog();
    return {
      response: `🗑️ Log file cleared`
    };
  }

  private handleLogLevelCommand(args: string[]): SlashCommandResult {
    if (args.length === 0) {
      const currentLevel = LogLevel[logger.getLogLevel()];
      return {
        response: `Current log level: ${currentLevel}\nAvailable levels: DEBUG, INFO, WARN, ERROR`
      };
    }

    const levelName = args[0].toUpperCase();
    const level = LogLevel[levelName as keyof typeof LogLevel];
    if (level !== undefined) {
      logger.setLogLevel(level);
      return {
        response: `✅ Log level set to: ${levelName}`
      };
    } else {
      return {
        response: `❌ Invalid log level. Available: DEBUG, INFO, WARN, ERROR`
      };
    }
  }

  private handleHelpCommand(): SlashCommandResult {
    return {
      response: `Available slash commands:
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
/loglevel DEBUG`
    };
  }
}