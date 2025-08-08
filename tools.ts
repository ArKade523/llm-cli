interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

// Define available MCP tools
export const mcpTools: MCPTool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to read"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file", 
    description: "Write content to a file",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to write to"
        },
        content: {
          type: "string",
          description: "The content to write to the file"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_files",
    description: "List files in a directory",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The directory path to list (defaults to current directory)",
          default: "."
        }
      },
      required: []
    }
  },
  {
    name: "run_command",
    description: "Execute a shell command",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute"
        }
      },
      required: ["command"]
    }
  }
];

// Execute MCP tool calls
export async function executeTool(toolCall: ToolCall): Promise<string> {
  const { name, arguments: args } = toolCall;
  
  try {
    switch (name) {
      case "read_file":
        const content = await Deno.readTextFile(args.path);
        return `File contents of ${args.path}:\n${content}`;
        
      case "write_file":
        await Deno.writeTextFile(args.path, args.content);
        return `Successfully wrote to ${args.path}`;
        
      case "list_files":
        const dirPath = args.path || ".";
        const entries = [];
        for await (const entry of Deno.readDir(dirPath)) {
          entries.push(`${entry.isDirectory ? "📁" : "📄"} ${entry.name}`);
        }
        return `Contents of ${dirPath}:\n${entries.join("\n")}`;
        
      case "run_command":
        const cmd = new Deno.Command("sh", {
          args: ["-c", args.command],
          stdout: "piped",
          stderr: "piped",
        });
        
        const { code, stdout, stderr } = await cmd.output();
        const output = new TextDecoder().decode(stdout);
        const error = new TextDecoder().decode(stderr);
        
        if (code !== 0) {
          return `Command failed (exit code ${code}):\n${error}`;
        }
        return `Command output:\n${output}`;
        
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
