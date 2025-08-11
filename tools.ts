interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Import the MCP user prompt function
declare const mcp__prompt_user__user_input: (params: { prompt: string }) => Promise<string>;

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
  },
  {
    name: "finished",
    description: "REQUIRED: Call this tool when you have completed your response and want to transfer control back to the user. This must be called at the end of every interaction.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "A brief summary of what you accomplished or found"
        }
      },
      required: ["summary"]
    }
  }
];

// Simple diff utility
function createDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  let diff = `📝 Changes to ${filePath}:\n`;
  diff += "=".repeat(50) + "\n";
  
  const maxLines = Math.max(oldLines.length, newLines.length);
  let hasChanges = false;
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      hasChanges = true;
      if (oldLines[i] !== undefined) {
        diff += `- ${i + 1}: ${oldLine}\n`;
      }
      if (newLines[i] !== undefined) {
        diff += `+ ${i + 1}: ${newLine}\n`;
      }
    }
  }
  
  if (!hasChanges) {
    diff += "No changes detected.\n";
  }
  
  diff += "=".repeat(50);
  return diff;
}

// Execute MCP tool calls
export async function executeTool(toolCall: ToolCall): Promise<string> {
  const { name, arguments: args } = toolCall;
  
  try {
    switch (name) {
      case "read_file":
        const content = await Deno.readTextFile(args.path);
        return `File contents of ${args.path}:\n${content}`;
        
      case "write_file":
        let oldContent = "";
        let isNewFile = false;
        
        try {
          oldContent = await Deno.readTextFile(args.path);
        } catch (error) {
          isNewFile = true;
        }
        
        const newContent = args.content;
        
        // Show diff and get approval
        let diffDisplay;
        if (isNewFile) {
          diffDisplay = `📝 Creating new file: ${args.path}\n`;
          diffDisplay += "=".repeat(50) + "\n";
          diffDisplay += `Content preview:\n${newContent.split('\n').slice(0, 10).join('\n')}`;
          if (newContent.split('\n').length > 10) {
            diffDisplay += `\n... (${newContent.split('\n').length - 10} more lines)`;
          }
          diffDisplay += "\n" + "=".repeat(50);
        } else {
          diffDisplay = createDiff(oldContent, newContent, args.path);
        }
        
        console.log(diffDisplay);
        
        // This is a simplified approach - in a real implementation you'd need
        // to integrate with the UI to show this properly
        const response = prompt(`\n${diffDisplay}\n\nApprove these changes? (y/N): `);
        
        if (response?.toLowerCase() === 'y' || response?.toLowerCase() === 'yes') {
          await Deno.writeTextFile(args.path, args.content);
          return `✅ Successfully wrote to ${args.path}`;
        } else {
          return `❌ File write cancelled by user`;
        }
        
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
        
      case "finished":
        return `CONVERSATION_COMPLETE:${args.summary}`;
        
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
