import { logger, LogLevel } from "./logger.ts";

// Configuration interfaces
export interface ModelProvider {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

export interface CustomProvider extends ModelProvider {
  name: string;
}

export interface ColorTheme {
  userColor: string;
  assistantColor: string;
  systemColor: string;
  borderColor: string;
  dimColor: string;
}

export interface AppConfig {
  version: string;
  general: {
    defaultModel: string;
    maxRecursionDepth: number;
    maxCompletionTokens: number;
    timerUpdateInterval: number;
    exitTimeout: number;
    logLevel: string;
  };
  providers: {
    openai: ModelProvider;
    anthropic: ModelProvider;
    custom: CustomProvider;
  };
  ui: {
    colorScheme: string;
    themes: Record<string, ColorTheme>;
  };
  files: {
    systemPromptFile: string;
    logFile: string;
  };
}

export class ConfigManager {
  private configPath = "../config.json";
  private config: AppConfig | null = null;
  private watchers: Set<(config: AppConfig) => void> = new Set();

  // Default configuration
  private defaultConfig: AppConfig = {
    version: "1.0.0",
    general: {
      defaultModel: "gpt-4o-mini",
      maxRecursionDepth: 10,
      maxCompletionTokens: 10000,
      timerUpdateInterval: 100,
      exitTimeout: 3000,
      logLevel: "INFO"
    },
    providers: {
      openai: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        models: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4o-2024-08-06",
          "gpt-4-turbo",
          "gpt-4",
          "gpt-3.5-turbo"
        ]
      },
      anthropic: {
        enabled: false,
        apiKey: "",
        baseUrl: "https://api.anthropic.com/v1",
        models: [
          "claude-3-5-sonnet-20241022",
          "claude-3-opus-20240229",
          "claude-3-haiku-20240307"
        ]
      },
      custom: {
        enabled: false,
        name: "Custom Provider",
        apiKey: "",
        baseUrl: "",
        models: []
      }
    },
    ui: {
      colorScheme: "default",
      themes: {
        default: {
          userColor: "green",
          assistantColor: "cyan",
          systemColor: "#ff9955",
          borderColor: "#aa9988",
          dimColor: "#aa9988"
        },
        dark: {
          userColor: "#4CAF50",
          assistantColor: "#2196F3",
          systemColor: "#FF9800",
          borderColor: "#666666",
          dimColor: "#888888"
        },
        light: {
          userColor: "#2E7D32",
          assistantColor: "#1976D2",
          systemColor: "#F57C00",
          borderColor: "#BDBDBD",
          dimColor: "#757575"
        }
      }
    },
    files: {
      systemPromptFile: "../prompt.txt",
      logFile: "../ai-cli.log"
    }
  };

  async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const configText = await Deno.readTextFile(this.configPath);
      const loadedConfig = JSON.parse(configText) as AppConfig;
      
      // Merge with defaults to handle missing properties
      this.config = this.mergeConfigs(this.defaultConfig, loadedConfig);
      
      // Load API keys from environment if not in config
      this.loadEnvironmentKeys();
      
      await logger.info("Configuration loaded successfully", {
        version: this.config?.version,
        providers: this.config ? Object.keys(this.config.providers).filter(
          key => this.config!.providers[key as keyof typeof this.config.providers].enabled
        ) : []
      });
      
      return this.config!;
    } catch (error) {
      await logger.warn("Could not load config file, creating default config", { error });
      return this.createDefaultConfig();
    }
  }

  async saveConfig(config?: AppConfig): Promise<void> {
    const configToSave = config || this.config;
    if (!configToSave) {
      throw new Error("No configuration to save");
    }

    try {
      // Create a copy without sensitive data for logging
      const configCopy = JSON.parse(JSON.stringify(configToSave));
      this.redactSensitiveData(configCopy);
      
      const configText = JSON.stringify(configToSave, null, 2);
      await Deno.writeTextFile(this.configPath, configText);
      
      this.config = configToSave;
      this.notifyWatchers();
      
      await logger.info("Configuration saved successfully", {
        version: configToSave.version
      });
    } catch (error) {
      await logger.error("Failed to save configuration", { error });
      throw error;
    }
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }
    return this.config;
  }

  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    const currentConfig = this.getConfig();
    const updatedConfig = this.mergeConfigs(currentConfig, updates);
    await this.saveConfig(updatedConfig);
  }

  async updateProviderConfig(
    provider: keyof AppConfig['providers'], 
    updates: Partial<ModelProvider | CustomProvider>
  ): Promise<void> {
    const currentConfig = this.getConfig();
    const updatedProviders = {
      ...currentConfig.providers,
      [provider]: { ...currentConfig.providers[provider], ...updates }
    };
    await this.updateConfig({ providers: updatedProviders });
  }

  async updateColorTheme(themeName: string, theme: ColorTheme): Promise<void> {
    const currentConfig = this.getConfig();
    const updatedThemes = {
      ...currentConfig.ui.themes,
      [themeName]: theme
    };
    await this.updateConfig({
      ui: { ...currentConfig.ui, themes: updatedThemes }
    });
  }

  async setActiveTheme(themeName: string): Promise<void> {
    const currentConfig = this.getConfig();
    if (!currentConfig.ui.themes[themeName]) {
      throw new Error(`Theme '${themeName}' does not exist`);
    }
    await this.updateConfig({
      ui: { ...currentConfig.ui, colorScheme: themeName }
    });
  }

  getCurrentTheme(): ColorTheme {
    const config = this.getConfig();
    const themeName = config.ui.colorScheme;
    return config.ui.themes[themeName] || config.ui.themes.default;
  }

  getAvailableModels(): string[] {
    const config = this.getConfig();
    const models: string[] = [];
    
    Object.entries(config.providers).forEach(([providerName, provider]) => {
      if (provider.enabled && provider.apiKey) {
        models.push(...provider.models.map(model => `${providerName}:${model}`));
      }
    });

    return models;
  }

  getProviderForModel(model: string): { provider: string; model: string } | null {
    if (model.includes(':')) {
      const [provider, modelName] = model.split(':', 2);
      return { provider, model: modelName };
    }
    
    // Default to OpenAI for backward compatibility
    return { provider: 'openai', model };
  }

  // Configuration validation
  validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!config.version) errors.push("Version is required");
    if (!config.general?.defaultModel) errors.push("Default model is required");

    // Validate providers
    let hasEnabledProvider = false;
    Object.entries(config.providers).forEach(([name, provider]) => {
      if (provider.enabled) {
        hasEnabledProvider = true;
        if (!provider.baseUrl) {
          errors.push(`Provider ${name} is enabled but missing base URL`);
        }
        if (!provider.models || provider.models.length === 0) {
          errors.push(`Provider ${name} is enabled but has no models`);
        }
      }
    });

    if (!hasEnabledProvider) {
      errors.push("At least one provider must be enabled");
    }

    // Validate UI
    if (!config.ui?.colorScheme) errors.push("Color scheme is required");
    if (!config.ui?.themes || Object.keys(config.ui.themes).length === 0) {
      errors.push("At least one theme is required");
    }

    return { valid: errors.length === 0, errors };
  }

  // Event system for config changes
  onConfigChange(callback: (config: AppConfig) => void): () => void {
    this.watchers.add(callback);
    return () => this.watchers.delete(callback);
  }

  private notifyWatchers(): void {
    if (this.config) {
      this.watchers.forEach(callback => callback(this.config!));
    }
  }

  // Private helper methods
  private async createDefaultConfig(): Promise<AppConfig> {
    this.config = JSON.parse(JSON.stringify(this.defaultConfig));
    this.loadEnvironmentKeys();
    await this.saveConfig();
    return this.config!;
  }

  private loadEnvironmentKeys(): void {
    if (!this.config) return;

    // Load API keys from environment
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      this.config.providers.openai.apiKey = openaiKey;
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (anthropicKey) {
      this.config.providers.anthropic.apiKey = anthropicKey;
    }

    // Set log level from environment
    const logLevel = Deno.env.get("LOG_LEVEL");
    if (logLevel) {
      this.config.general.logLevel = logLevel;
      // Update logger level
      const level = LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel];
      if (level !== undefined) {
        logger.setLogLevel(level);
      }
    }
  }

  private mergeConfigs(base: any, updates: any): any {
    const result = { ...base };
    
    for (const key in updates) {
      if (updates[key] !== null && typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, updates[key]);
      } else {
        result[key] = updates[key];
      }
    }
    
    return result;
  }

  private redactSensitiveData(config: any): void {
    if (config.providers) {
      Object.values(config.providers).forEach((provider: any) => {
        if (provider.apiKey) {
          provider.apiKey = provider.apiKey.substring(0, 8) + "...";
        }
      });
    }
  }
}

// Export singleton instance
export const configManager = new ConfigManager();