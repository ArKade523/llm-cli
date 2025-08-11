import { configManager, AppConfig, ColorTheme } from "./configManager.ts";
import { logger } from "./logger.ts";
import { Message } from "./config.ts";

export interface ConfigCommandResult {
  response: string;
  isAsync?: boolean;
  asyncHandler?: () => Promise<void>;
}

export class ConfigCommandHandler {
  constructor(
    private setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    private messages: Message[]
  ) {}

  handleCommand(command: string): ConfigCommandResult {
    const parts = command.slice(1).trim().split(' ');
    const subcommand = parts[1]?.toLowerCase();
    const args = parts.slice(2);

    switch (subcommand) {
      case 'show':
      case 'view':
        return this.handleShowConfig(args);
      
      case 'set':
        return this.handleSetConfig(args);
      
      case 'provider':
        return this.handleProviderConfig(args);
      
      case 'theme':
        return this.handleThemeConfig(args);
      
      case 'init':
      case 'setup':
        return this.handleInitConfig();
      
      case 'validate':
        return this.handleValidateConfig();
      
      case 'export':
        return this.handleExportConfig(args);
      
      case 'import':
        return this.handleImportConfig(args);
      
      case 'reset':
        return this.handleResetConfig(args);
      
      case 'help':
      default:
        return this.handleConfigHelp();
    }
  }

  private handleShowConfig(args: string[]): ConfigCommandResult {
    const section = args[0]?.toLowerCase();
    
    return {
      response: "📋 Loading configuration...",
      isAsync: true,
      asyncHandler: async () => {
        try {
          const config = configManager.getConfig();
          let content = "";

          switch (section) {
            case 'general':
              content = this.formatGeneralConfig(config);
              break;
            case 'providers':
              content = this.formatProvidersConfig(config);
              break;
            case 'ui':
            case 'theme':
              content = this.formatUIConfig(config);
              break;
            case 'files':
              content = this.formatFilesConfig(config);
              break;
            default:
              content = this.formatFullConfig(config);
          }

          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `📋 Configuration${section ? ` (${section})` : ""}:\n\`\`\`json\n${content}\n\`\`\``,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error loading configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleSetConfig(args: string[]): ConfigCommandResult {
    if (args.length < 2) {
      return {
        response: "❌ Usage: /config set <path> <value>\nExample: /config set general.defaultModel gpt-4o"
      };
    }

    const path = args[0];
    const value = args.slice(1).join(' ');

    return {
      response: `⚙️ Updating configuration ${path}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          await this.setConfigValue(path, value);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Configuration updated: ${path} = ${value}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error updating configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleProviderConfig(args: string[]): ConfigCommandResult {
    const action = args[0]?.toLowerCase();
    const provider = args[1];

    switch (action) {
      case 'enable':
        return this.toggleProvider(provider, true);
      case 'disable':
        return this.toggleProvider(provider, false);
      case 'key':
        return this.setProviderKey(provider, args[2]);
      case 'url':
        return this.setProviderUrl(provider, args[2]);
      case 'list':
        return this.listProviders();
      default:
        return {
          response: `❌ Usage: /config provider <enable|disable|key|url|list> [provider] [value]\nExamples:\n/config provider enable anthropic\n/config provider key openai sk-xxx\n/config provider list`
        };
    }
  }

  private handleThemeConfig(args: string[]): ConfigCommandResult {
    const action = args[0]?.toLowerCase();
    const themeName = args[1];

    switch (action) {
      case 'set':
      case 'use':
        return this.setTheme(themeName);
      case 'list':
        return this.listThemes();
      case 'create':
        return this.createTheme(themeName);
      case 'edit':
        return this.editTheme(themeName, args.slice(2));
      default:
        return {
          response: `❌ Usage: /config theme <set|list|create|edit> [theme] [options]\nExamples:\n/config theme set dark\n/config theme list\n/config theme create mytheme`
        };
    }
  }

  private handleInitConfig(): ConfigCommandResult {
    return {
      response: "🚀 Starting configuration setup...",
      isAsync: true,
      asyncHandler: async () => {
        try {
          // This would ideally open an interactive setup
          const config = await configManager.loadConfig();
          const validation = configManager.validateConfig(config);
          
          let content = "🔧 Configuration initialized!\n\n";
          
          if (!validation.valid) {
            content += "⚠️ Issues found:\n";
            validation.errors.forEach(error => {
              content += `• ${error}\n`;
            });
            content += "\nUse `/config set` commands to fix these issues.\n\n";
          }

          content += "Quick setup commands:\n";
          content += "• `/config provider key openai YOUR_API_KEY` - Set OpenAI API key\n";
          content += "• `/config set general.defaultModel gpt-4o-mini` - Set default model\n";
          content += "• `/config theme set dark` - Switch to dark theme\n";
          content += "• `/config show` - View current configuration";

          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: content,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error initializing configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleValidateConfig(): ConfigCommandResult {
    return {
      response: "🔍 Validating configuration...",
      isAsync: true,
      asyncHandler: async () => {
        try {
          const config = configManager.getConfig();
          const validation = configManager.validateConfig(config);
          
          let content = validation.valid 
            ? "✅ Configuration is valid!" 
            : "❌ Configuration has issues:";
          
          if (!validation.valid) {
            validation.errors.forEach(error => {
              content += `\n• ${error}`;
            });
          }

          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: content,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error validating configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleExportConfig(args: string[]): ConfigCommandResult {
    const filename = args[0] || `config-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    return {
      response: `📤 Exporting configuration to ${filename}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          const config = configManager.getConfig();
          const configText = JSON.stringify(config, null, 2);
          await Deno.writeTextFile(filename, configText);
          
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Configuration exported to ${filename}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error exporting configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleImportConfig(args: string[]): ConfigCommandResult {
    if (!args[0]) {
      return {
        response: "❌ Usage: /config import <filename>"
      };
    }

    const filename = args[0];
    
    return {
      response: `📥 Importing configuration from ${filename}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          const configText = await Deno.readTextFile(filename);
          const importedConfig = JSON.parse(configText) as AppConfig;
          
          const validation = configManager.validateConfig(importedConfig);
          if (!validation.valid) {
            const message: Message = {
              id: this.messages.length + 3,
              role: "assistant",
              content: `❌ Invalid configuration file:\n${validation.errors.join('\n')}`,
              timestamp: new Date(),
            };
            this.setMessages(prev => [...prev, message]);
            return;
          }

          await configManager.saveConfig(importedConfig);
          
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Configuration imported from ${filename}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error importing configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleResetConfig(args: string[]): ConfigCommandResult {
    const section = args[0]?.toLowerCase();
    
    return {
      response: `🔄 Resetting ${section || 'all'} configuration...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          if (section) {
            // Reset specific section (would need implementation)
            throw new Error("Section reset not implemented yet");
          } else {
            // Reset entire config by creating default
            await Deno.remove("../config.json");
            await configManager.loadConfig();
          }
          
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Configuration reset to defaults`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error resetting configuration: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private handleConfigHelp(): ConfigCommandResult {
    return {
      response: `⚙️ Configuration Management Commands:

📋 Viewing:
/config show [section] - Show configuration (sections: general, providers, ui, files)
/config validate - Validate current configuration

⚙️ Settings:
/config set <path> <value> - Set configuration value
/config init - Initialize/setup configuration

👤 Providers:
/config provider enable <name> - Enable provider (openai, anthropic, custom)
/config provider disable <name> - Disable provider
/config provider key <name> <key> - Set API key for provider
/config provider url <name> <url> - Set base URL for provider
/config provider list - List all providers

🎨 Themes:
/config theme set <name> - Switch theme (default, dark, light)
/config theme list - List available themes
/config theme create <name> - Create new theme
/config theme edit <name> <property> <value> - Edit theme property

📁 Import/Export:
/config export [filename] - Export configuration
/config import <filename> - Import configuration
/config reset [section] - Reset configuration to defaults

Examples:
/config set general.defaultModel gpt-4o
/config provider key openai sk-xxx
/config theme set dark
/config show providers`
    };
  }

  // Helper methods
  private async setConfigValue(path: string, value: string): Promise<void> {
    const config = configManager.getConfig();
    const pathParts = path.split('.');
    
    let current: any = config;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!(pathParts[i] in current)) {
        throw new Error(`Invalid configuration path: ${path}`);
      }
      current = current[pathParts[i]];
    }
    
    const finalKey = pathParts[pathParts.length - 1];
    if (!(finalKey in current)) {
      throw new Error(`Invalid configuration key: ${path}`);
    }
    
    // Type conversion
    let convertedValue: any = value;
    if (typeof current[finalKey] === 'number') {
      convertedValue = parseInt(value);
      if (isNaN(convertedValue)) {
        throw new Error(`Value must be a number for ${path}`);
      }
    } else if (typeof current[finalKey] === 'boolean') {
      convertedValue = value.toLowerCase() === 'true';
    }
    
    current[finalKey] = convertedValue;
    await configManager.saveConfig(config);
  }

  private toggleProvider(provider: string, enabled: boolean): ConfigCommandResult {
    if (!provider) {
      return {
        response: "❌ Provider name required"
      };
    }

    return {
      response: `⚙️ ${enabled ? 'Enabling' : 'Disabling'} ${provider} provider...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          await configManager.updateProviderConfig(provider as any, { enabled });
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Provider ${provider} ${enabled ? 'enabled' : 'disabled'}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error updating provider: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private setProviderKey(provider: string, key: string): ConfigCommandResult {
    if (!provider || !key) {
      return {
        response: "❌ Both provider name and API key required"
      };
    }

    return {
      response: `🔑 Setting API key for ${provider}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          await configManager.updateProviderConfig(provider as any, { apiKey: key });
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ API key set for ${provider}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error setting API key: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private setProviderUrl(provider: string, url: string): ConfigCommandResult {
    if (!provider || !url) {
      return {
        response: "❌ Both provider name and URL required"
      };
    }

    return {
      response: `🔗 Setting base URL for ${provider}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          await configManager.updateProviderConfig(provider as any, { baseUrl: url });
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Base URL set for ${provider}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error setting base URL: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private listProviders(): ConfigCommandResult {
    return {
      response: "📋 Loading providers...",
      isAsync: true,
      asyncHandler: async () => {
        try {
          const config = configManager.getConfig();
          let content = "🏢 Available Providers:\n\n";
          
          Object.entries(config.providers).forEach(([name, provider]) => {
            const status = provider.enabled ? "✅ Enabled" : "❌ Disabled";
            const hasKey = provider.apiKey ? "🔑 Has API Key" : "⚠️ No API Key";
            const modelCount = provider.models.length;
            
            content += `**${name.toUpperCase()}**\n`;
            content += `• Status: ${status}\n`;
            content += `• ${hasKey}\n`;
            content += `• Models: ${modelCount} available\n`;
            content += `• Base URL: ${provider.baseUrl}\n\n`;
          });

          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: content,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error listing providers: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private setTheme(themeName: string): ConfigCommandResult {
    if (!themeName) {
      return {
        response: "❌ Theme name required"
      };
    }

    return {
      response: `🎨 Setting theme to ${themeName}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          await configManager.setActiveTheme(themeName);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Theme changed to ${themeName}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error setting theme: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private listThemes(): ConfigCommandResult {
    return {
      response: "🎨 Loading themes...",
      isAsync: true,
      asyncHandler: async () => {
        try {
          const config = configManager.getConfig();
          const currentTheme = config.ui.colorScheme;
          let content = "🎨 Available Themes:\n\n";
          
          Object.entries(config.ui.themes).forEach(([name, theme]) => {
            const current = name === currentTheme ? " ← Current" : "";
            content += `**${name}**${current}\n`;
            content += `• User: ${theme.userColor}\n`;
            content += `• Assistant: ${theme.assistantColor}\n`;
            content += `• System: ${theme.systemColor}\n`;
            content += `• Border: ${theme.borderColor}\n\n`;
          });

          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: content,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error listing themes: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private createTheme(themeName: string): ConfigCommandResult {
    if (!themeName) {
      return {
        response: "❌ Theme name required"
      };
    }

    return {
      response: `🎨 Creating theme ${themeName}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          const currentTheme = configManager.getCurrentTheme();
          await configManager.updateColorTheme(themeName, currentTheme);
          
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Theme ${themeName} created (based on current theme)\nUse /config theme edit to customize it`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error creating theme: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  private editTheme(themeName: string, args: string[]): ConfigCommandResult {
    if (!themeName || args.length < 2) {
      return {
        response: "❌ Usage: /config theme edit <theme> <property> <value>\nProperties: userColor, assistantColor, systemColor, borderColor, dimColor"
      };
    }

    const property = args[0];
    const value = args[1];

    return {
      response: `🎨 Editing theme ${themeName}...`,
      isAsync: true,
      asyncHandler: async () => {
        try {
          const config = configManager.getConfig();
          const theme = config.ui.themes[themeName];
          
          if (!theme) {
            throw new Error(`Theme ${themeName} not found`);
          }

          if (!(property in theme)) {
            throw new Error(`Invalid theme property: ${property}`);
          }

          const updatedTheme = { ...theme, [property]: value };
          await configManager.updateColorTheme(themeName, updatedTheme);
          
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `✅ Theme ${themeName} updated: ${property} = ${value}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message: Message = {
            id: this.messages.length + 3,
            role: "assistant",
            content: `❌ Error editing theme: ${errorMsg}`,
            timestamp: new Date(),
          };
          this.setMessages(prev => [...prev, message]);
        }
      }
    };
  }

  // Formatting helpers
  private formatGeneralConfig(config: AppConfig): string {
    return JSON.stringify(config.general, null, 2);
  }

  private formatProvidersConfig(config: AppConfig): string {
    const redacted = JSON.parse(JSON.stringify(config.providers));
    Object.values(redacted).forEach((provider: any) => {
      if (provider.apiKey) {
        provider.apiKey = provider.apiKey.substring(0, 8) + "...";
      }
    });
    return JSON.stringify(redacted, null, 2);
  }

  private formatUIConfig(config: AppConfig): string {
    return JSON.stringify(config.ui, null, 2);
  }

  private formatFilesConfig(config: AppConfig): string {
    return JSON.stringify(config.files, null, 2);
  }

  private formatFullConfig(config: AppConfig): string {
    const redacted = JSON.parse(JSON.stringify(config));
    Object.values(redacted.providers).forEach((provider: any) => {
      if (provider.apiKey) {
        provider.apiKey = provider.apiKey.substring(0, 8) + "...";
      }
    });
    return JSON.stringify(redacted, null, 2);
  }
}

