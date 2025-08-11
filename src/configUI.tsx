import React, { useState, useEffect } from "npm:react";
import { Box, Text, useInput } from "npm:ink";
import TextInput from "npm:ink-text-input@5";
import { configManager, AppConfig, ModelProvider } from "./configManager.ts";
import { logger } from "./logger.ts";

export interface ConfigUIProps {
  onExit: () => void;
  onConfigChange?: (config: AppConfig) => void;
}

interface MenuItem {
  key: string;
  label: string;
  description: string;
}

type ConfigMode = 'menu' | 'setup' | 'providers' | 'themes' | 'general' | 'input';

interface InputState {
  prompt: string;
  value: string;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
  isPassword?: boolean;
}

export function ConfigUI({ onExit, onConfigChange }: ConfigUIProps) {
  const [mode, setMode] = useState<ConfigMode>('menu');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputState, setInputState] = useState<InputState | null>(null);
  const [message, setMessage] = useState<string>("");
  const [setupStep, setSetupStep] = useState(0);

  // Main menu items
  const mainMenuItems: MenuItem[] = [
    { key: 'setup', label: '🚀 Quick Setup', description: 'Guided setup wizard for new users' },
    { key: 'providers', label: '🏢 API Providers', description: 'Manage OpenAI, Anthropic, and custom providers' },
    { key: 'themes', label: '🎨 Themes', description: 'Customize colors and appearance' },
    { key: 'general', label: '⚙️ General Settings', description: 'Default model, logging, and other settings' },
    { key: 'view', label: '📋 View Config', description: 'Show current configuration' },
    { key: 'export', label: '💾 Export/Import', description: 'Backup and restore configuration' },
    { key: 'exit', label: '❌ Exit', description: 'Return to chat' }
  ];

  // Provider menu items
  const providerMenuItems: MenuItem[] = [
    { key: 'openai', label: '🤖 OpenAI', description: 'Configure OpenAI API (GPT models)' },
    { key: 'anthropic', label: '🧠 Anthropic', description: 'Configure Anthropic API (Claude models)' },
    { key: 'custom', label: '🔧 Custom Provider', description: 'Add custom API provider' },
    { key: 'back', label: '← Back', description: 'Return to main menu' }
  ];

  // Theme menu items
  const themeMenuItems: MenuItem[] = [
    { key: 'default', label: '🌈 Default Theme', description: 'Classic colors (green/cyan)' },
    { key: 'dark', label: '🌙 Dark Theme', description: 'Dark professional theme' },
    { key: 'light', label: '☀️ Light Theme', description: 'Light clean theme' },
    { key: 'create', label: '🎨 Create Theme', description: 'Create custom color theme' },
    { key: 'back', label: '← Back', description: 'Return to main menu' }
  ];

  // Setup wizard steps
  const setupSteps = [
    "Welcome! Let's set up your AI CLI. Press Enter to continue...",
    "First, let's configure your OpenAI API key.",
    "Would you like to enable additional providers? (Anthropic, etc.)",
    "Choose your preferred default model.",
    "Select a color theme for the interface.",
    "Setup complete! Your configuration has been saved."
  ];

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await configManager.loadConfig();
      setConfig(loadedConfig);
    } catch (error) {
      setMessage(`❌ Error loading config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Keyboard navigation
  useInput((_input, key) => {
    if (mode === 'input') {
      // Input mode is handled by TextInput component
      return;
    }

    if (key.escape) {
      if (mode === 'menu') {
        onExit();
      } else {
        setMode('menu');
        setSelectedIndex(0);
        setMessage("");
      }
      return;
    }

    if (key.upArrow) {
      const maxIndex = getCurrentMenuItems().length - 1;
      setSelectedIndex(prev => prev > 0 ? prev - 1 : maxIndex);
    }

    if (key.downArrow) {
      const maxIndex = getCurrentMenuItems().length - 1;
      setSelectedIndex(prev => prev < maxIndex ? prev + 1 : 0);
    }

    if (key.return) {
      if (mode === 'setup') {
        handleSetupWizard();
      } else {
        handleMenuSelect();
      }
    }
  });

  const getCurrentMenuItems = (): MenuItem[] => {
    switch (mode) {
      case 'providers': return providerMenuItems;
      case 'themes': return themeMenuItems;
      default: return mainMenuItems;
    }
  };

  const handleMenuSelect = async () => {
    const items = getCurrentMenuItems();
    const selected = items[selectedIndex];

    switch (selected.key) {
      case 'setup':
        setMode('setup');
        setSetupStep(0);
        setMessage("");
        break;
      
      case 'providers':
        setMode('providers');
        setSelectedIndex(0);
        break;
      
      case 'themes':
        setMode('themes');
        setSelectedIndex(0);
        break;
      
      case 'general':
        setMode('general');
        setSelectedIndex(0);
        break;
      
      case 'view':
        await handleViewConfig();
        break;
      
      case 'export':
        await handleExportConfig();
        break;
      
      case 'exit':
        onExit();
        break;
      
      case 'back':
        setMode('menu');
        setSelectedIndex(0);
        break;

      // Provider-specific actions
      case 'openai':
      case 'anthropic':
      case 'custom':
        await handleProviderConfig(selected.key);
        break;

      // Theme actions
      case 'default':
      case 'dark':
      case 'light':
        await handleThemeSelect(selected.key);
        break;
      
      case 'create':
        await handleCreateTheme();
        break;
    }
  };

  const handleSetupWizard = async () => {
    if (setupStep === 0) {
      // Welcome step
      setSetupStep(1);
    } else if (setupStep === 1) {
      // OpenAI API key
      await promptForInput(
        "Enter your OpenAI API Key (or press Enter to skip):",
        async (value) => {
          if (value.trim()) {
            await configManager.updateProviderConfig('openai', { apiKey: value.trim(), enabled: true });
            setMessage("✅ OpenAI API key configured!");
          }
          setSetupStep(2);
        },
        true // isPassword
      );
    } else if (setupStep === 2) {
      // Additional providers
      const shouldSetupMore = await promptYesNo("Would you like to configure Anthropic Claude? (y/n):");
      if (shouldSetupMore) {
        await promptForInput(
          "Enter your Anthropic API Key:",
          async (value) => {
            if (value.trim()) {
              await configManager.updateProviderConfig('anthropic', { apiKey: value.trim(), enabled: true });
              setMessage("✅ Anthropic API key configured!");
            }
            setSetupStep(3);
          },
          true
        );
      } else {
        setSetupStep(3);
      }
    } else if (setupStep === 3) {
      // Default model selection
      await handleModelSelection();
    } else if (setupStep === 4) {
      // Theme selection
      await handleThemeSelection();
    } else if (setupStep === 5) {
      // Complete
      setMessage("🎉 Setup complete! Welcome to your AI CLI!");
      setTimeout(() => {
        onExit();
      }, 2000);
    }
  };

  const promptForInput = async (
    prompt: string, 
    onSubmit: (value: string) => Promise<void>,
    isPassword = false
  ): Promise<void> => {
    return new Promise((resolve) => {
      setInputState({
        prompt,
        value: "",
        isPassword,
        onSubmit: async (value) => {
          await onSubmit(value);
          setInputState(null);
          resolve();
        },
        onCancel: () => {
          setInputState(null);
          resolve();
        }
      });
      setMode('input');
    });
  };

  const promptYesNo = async (prompt: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setInputState({
        prompt: prompt + " (y/n)",
        value: "",
        onSubmit: async (value) => {
          const result = value.toLowerCase().startsWith('y');
          setInputState(null);
          resolve(result);
        },
        onCancel: () => {
          setInputState(null);
          resolve(false);
        }
      });
      setMode('input');
    });
  };

  const handleProviderConfig = async (provider: string) => {
    if (!config) return;
    
    const providerConfig = config.providers[provider as keyof typeof config.providers] as ModelProvider;
    const hasKey = providerConfig?.apiKey ? "✅ Configured" : "❌ No API Key";
    const status = providerConfig?.enabled ? "✅ Enabled" : "❌ Disabled";
    
    setMessage(`${provider.toUpperCase()} Provider:\n${status} | ${hasKey}\n\nPress 'k' for API key, 'e' to enable/disable, 'Esc' to go back`);
    
    // Wait for user input
    const handleProviderInput = (input: string, key: any) => {
      if (key.escape) {
        setMode('providers');
        setMessage("");
        return;
      }
      
      if (input.toLowerCase() === 'k') {
        promptForInput(
          `Enter ${provider.toUpperCase()} API Key:`,
          async (value) => {
            if (value.trim()) {
              await configManager.updateProviderConfig(provider as any, { 
                apiKey: value.trim(), 
                enabled: true 
              });
              setMessage(`✅ ${provider.toUpperCase()} API key saved and provider enabled!`);
              await loadConfig();
              if (onConfigChange && config) onConfigChange(config);
            }
            setTimeout(() => setMode('providers'), 1000);
          },
          true
        );
      } else if (input.toLowerCase() === 'e') {
        configManager.updateProviderConfig(provider as any, { 
          enabled: !providerConfig?.enabled 
        }).then(() => {
          setMessage(`✅ ${provider.toUpperCase()} ${providerConfig?.enabled ? 'disabled' : 'enabled'}!`);
          loadConfig();
          setTimeout(() => setMode('providers'), 1000);
        });
      }
    };

    // This is a simplified approach - in a real implementation, you'd want a more sophisticated state machine
  };

  const handleThemeSelect = async (themeName: string) => {
    try {
      await configManager.setActiveTheme(themeName);
      setMessage(`✅ Theme changed to ${themeName}!`);
      await loadConfig();
      if (onConfigChange && config) onConfigChange(config);
      setTimeout(() => setMode('menu'), 1000);
    } catch (error) {
      setMessage(`❌ Error setting theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCreateTheme = async () => {
    await promptForInput(
      "Enter theme name:",
      async (name) => {
        if (name.trim()) {
          try {
            const currentTheme = configManager.getCurrentTheme();
            await configManager.updateColorTheme(name.trim(), currentTheme);
            setMessage(`✅ Theme '${name}' created!`);
            await loadConfig();
          } catch (error) {
            setMessage(`❌ Error creating theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        setTimeout(() => setMode('themes'), 1000);
      }
    );
  };

  const handleViewConfig = async () => {
    if (!config) return;
    
    // Create a redacted copy for display
    const displayConfig = JSON.parse(JSON.stringify(config));
    Object.values(displayConfig.providers).forEach((provider: any) => {
      if (provider.apiKey) {
        provider.apiKey = provider.apiKey.substring(0, 8) + "...";
      }
    });
    
    setMessage(`📋 Current Configuration:\n\`\`\`json\n${JSON.stringify(displayConfig, null, 2)}\n\`\`\``);
  };

  const handleExportConfig = async () => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `config-backup-${timestamp}.json`;
      const configText = JSON.stringify(config, null, 2);
      await Deno.writeTextFile(filename, configText);
      setMessage(`✅ Configuration exported to ${filename}`);
    } catch (error) {
      setMessage(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleModelSelection = async () => {
    if (!config) return;
    
    const availableModels = configManager.getAvailableModels();
    if (availableModels.length === 0) {
      setMessage("❌ No models available. Please configure API providers first.");
      setSetupStep(5);
      return;
    }
    
    setMessage(`Available models: ${availableModels.join(', ')}\nCurrent: ${config.general.defaultModel}`);
    
    await promptForInput(
      "Enter default model name:",
      async (value) => {
        if (value.trim() && availableModels.includes(value.trim())) {
          await configManager.updateConfig({
            general: { ...config.general, defaultModel: value.trim() }
          });
          setMessage(`✅ Default model set to ${value.trim()}!`);
          await loadConfig();
        } else if (value.trim()) {
          setMessage("❌ Invalid model name.");
        }
        setSetupStep(4);
      }
    );
  };

  const handleThemeSelection = async () => {
    const themes = ['default', 'dark', 'light'];
    setMessage(`Available themes: ${themes.join(', ')}`);
    
    await promptForInput(
      "Enter theme name:",
      async (value) => {
        if (value.trim() && themes.includes(value.trim())) {
          await configManager.setActiveTheme(value.trim());
          setMessage(`✅ Theme set to ${value.trim()}!`);
          await loadConfig();
        } else if (value.trim()) {
          setMessage("❌ Invalid theme name.");
        }
        setSetupStep(5);
      }
    );
  };

  // Render input mode
  if (mode === 'input' && inputState) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">⚙️ Configuration</Text>
        <Box marginY={1} />
        <Text>{inputState.prompt || "Enter value:"}</Text>
        <Box marginTop={1}>
          <Text color="yellow">❯ </Text>
          <TextInput
            value={inputState.value}
            onChange={(value) => setInputState({ ...inputState, value })}
            onSubmit={(value) => inputState.onSubmit(value)}
            placeholder={inputState.isPassword ? "••••••••" : "Type here..."}
            {...(inputState.isPassword ? { mask: "•" } : {})}
          />
        </Box>
        <Box marginTop={1} />
        <Text>Press Esc to cancel</Text>
      </Box>
    );
  }

  // Render setup wizard
  if (mode === 'setup') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">🚀 Quick Setup Wizard</Text>
        <Text color="dim">Step {setupStep + 1} of {setupSteps.length}</Text>
        <Box marginY={1} />
        <Text>{setupSteps[setupStep] || "Loading..."}</Text>
        <Box marginY={1} />
        {setupStep === 0 && (
          <>
            <Text>This wizard will help you:</Text>
            <Text>• Set up API keys for AI providers</Text>
            <Text>• Choose your default model</Text>
            <Text>• Customize the interface theme</Text>
            <Box marginY={1} />
            <Text color="dim">Press Enter to start, or Esc to skip</Text>
          </>
        )}
        {message && (
          <>
            <Box marginY={1} />
            <Text>{message || "Status message"}</Text>
          </>
        )}
      </Box>
    );
  }

  // Render main menu
  const items = getCurrentMenuItems();
  const currentTheme = config ? configManager.getCurrentTheme() : null;

  return (
    <Box flexDirection="column" padding={1}>
      {[
        /* ───────────────────── title ───────────────────── */
        <Text
          key="title"
          bold
          color={currentTheme?.systemColor ?? 'cyan'}
        >
          ⚙️ Configuration Menu
        </Text>,

        /* ───────────────────── hint ────────────────────── */
        <Text key="hint" color="dim">
          Use arrow keys to navigate, Enter to select, Esc to exit
        </Text>,

        /* ───────────── top spacer (1 line) ─────────────── */
        <Box key="spacer-top" marginY={1} />,

        /* ─────────────────── menu items ────────────────── */
        ...items.map((item, index) => {
          const selected = index === selectedIndex;

          return (
            <Box key={item.key}>
              <Text
                color={
                  selected
                    ? currentTheme?.userColor ?? 'green'
                    : 'white'
                }
              >
                {`${selected ? '❯ ' : '  '}${item.label ?? 'Menu Item'}`}
              </Text>

              {selected && (
                <Box marginLeft={4}>
                  <Text color="dim">
                    {item.description ?? 'No description'}
                  </Text>
                </Box>
              )}
            </Box>
          );
        }),

        /* ───────────── optional message box ────────────── */
        message && (
          <Box
            key="message"
            marginTop={1}
            borderStyle="single"
            borderColor={currentTheme?.borderColor ?? 'gray'}
            padding={1}
          >
            <Text>{message}</Text>
          </Box>
        ),

        /* ───────────── bottom spacer (1 line) ──────────── */
        <Box key="spacer-bottom" marginY={1} />,

        /* ───────────────────── footer ──────────────────── */
        <Text key="footer" color="dim">
          {mode === 'menu'
            ? 'Navigation: ↑↓ arrow keys, Enter to select, Esc to exit'
            : 'Press Esc to go back'}
        </Text>
      ].filter(Boolean)}
    </Box>
  );
}
