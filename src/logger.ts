export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logFile = "../ai-cli.log";
  private currentLogLevel = LogLevel.INFO;

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLogEntry(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.formatTimestamp();
    const levelName = LogLevel[level];
    let logLine = `[${timestamp}] ${levelName}: ${message}`;
    
    if (data !== undefined) {
      logLine += ` | ${JSON.stringify(data, null, 2)}`;
    }
    
    return logLine + '\n';
  }

  private async writeToFile(entry: string): Promise<void> {
    try {
      await Deno.writeTextFile(this.logFile, entry, { append: true });
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLogLevel;
  }

  async debug(message: string, data?: any): Promise<void> {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.formatLogEntry(LogLevel.DEBUG, message, data);
    await this.writeToFile(entry);
  }

  async info(message: string, data?: any): Promise<void> {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.formatLogEntry(LogLevel.INFO, message, data);
    await this.writeToFile(entry);
  }

  async warn(message: string, data?: any): Promise<void> {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.formatLogEntry(LogLevel.WARN, message, data);
    await this.writeToFile(entry);
  }

  async error(message: string, data?: any): Promise<void> {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.formatLogEntry(LogLevel.ERROR, message, data);
    await this.writeToFile(entry);
  }

  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  async clearLog(): Promise<void> {
    try {
      await Deno.writeTextFile(this.logFile, "");
      await this.info("Log file cleared");
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }

  async readLog(lines?: number): Promise<string> {
    try {
      const content = await Deno.readTextFile(this.logFile);
      if (lines) {
        const logLines = content.split('\n');
        return logLines.slice(-lines).join('\n');
      }
      return content;
    } catch (error) {
      await this.warn("Failed to read log file", { error: error.message });
      return "Log file not found or cannot be read.";
    }
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Initialize logger
logger.info("Logger initialized");