# AI CLI Chat

A terminal-based AI chat interface built with React 18, Ink, and Deno that provides interactive conversations with OpenAI's GPT models and includes MCP (Model Context Protocol) tool support.

## Features

- **Interactive Chat Interface** - Real-time conversations with AI
- **MCP Tool Integration** - File operations, directory listing, and shell commands
- **Built with Modern Stack** - React 18, Ink, Deno, TypeScript
- **Terminal UI** - Clean, responsive terminal interface
- **Safe Exit** - Double Ctrl+C or Escape to prevent accidental exits
- **File System Access** - Read, write, and list files through AI commands

## Prerequisites

- [Deno](https://deno.land/) installed
- OpenAI API key

## Setup

1. Clone or download this project
2. Set your OpenAI API key as an environment variable:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

## Usage

### Start the application
```bash
deno task start
```

### Development mode (with hot reload)
```bash
deno task dev
```

### Controls
- **Enter** - Send message
- **Ctrl+C twice** - Exit application
- **Escape twice** - Exit application

## Available AI Tools

The AI assistant has access to these MCP tools:

### File Operations
- **read_file** - Read contents of any file
- **write_file** - Write content to files
- **list_files** - List directory contents
- **run_command** - Execute shell commands

### Example Commands
Try asking the AI:
- "List the files in this directory"
- "Read the contents of main.tsx"
- "Create a new file called test.txt with some example content"
- "Run the command 'git status'"

## Project Structure

```
llm-cli/
├── main.tsx          # Main React application
├── tools.ts          # MCP tool definitions and execution
├── deno.jsonc        # Deno configuration and dependencies
└── README.md         # This file
```

## Configuration

### deno.jsonc
The project configuration includes:
- **React 18** with JSX runtime
- **Ink 3.2.0** for terminal UI
- **OpenAI SDK** for GPT integration
- **MCP SDK** for tool protocol support

### Environment Variables
- `OPENAI_API_KEY` - Required for OpenAI API access

## Dependencies

- `react@^18.2.0` - UI framework
- `ink@^3.2.0` - Terminal UI components
- `openai@^4.47.1` - OpenAI API client
- `@modelcontextprotocol/sdk@^0.5.0` - MCP protocol support
- `ink-text-input@5` - Terminal input component

## Architecture

The application follows a component-based architecture:

1. **Main App** (`main.tsx`) - Handles UI state, user input, and AI interactions
2. **Tools Module** (`tools.ts`) - Defines and executes MCP tools
3. **OpenAI Integration** - Implements function calling with tool support

### Message Flow
1. User types message and presses Enter
2. Message added to conversation history
3. OpenAI API called with tools and conversation context
4. If AI decides to use tools, they're executed automatically
5. Results displayed in the terminal with tool indicators (🔧)

## Development

### Adding New Tools
1. Define tool schema in `tools.ts`
2. Add execution logic to `executeTool()` function
3. Tools are automatically available to the AI

### Modifying UI
The terminal interface uses Ink components. Key components:
- `Box` - Layout containers
- `Text` - Styled text output
- `TextInput` - User input field

## Security

- Tools execute with Deno's permission system
- File operations require `--allow-read` and `--allow-write`
- Shell commands require appropriate permissions
- API key handled through environment variables

## Troubleshooting

### Common Issues

**"Module not found" errors**
- Run `deno cache main.tsx` to download dependencies

**"Permission denied" errors**
- Ensure you're running with appropriate Deno permissions:
  ```bash
  deno run --allow-env --allow-read --allow-write --allow-net main.tsx
  ```

**API key errors**
- Verify your `OPENAI_API_KEY` environment variable is set
- Check that your API key has sufficient credits

**JSX runtime errors**
- Ensure you're using the provided `deno.jsonc` configuration
