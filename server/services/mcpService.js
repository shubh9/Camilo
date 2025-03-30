const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const Anthropic = require("@anthropic-ai/sdk");

// Load MCP tools configuration
const mcpConfig = require("../config/mcp-tools.json");

class MCPClientManager {
  constructor(anthropicClient) {
    this.mcpClients = {}; // Map of server name to MCP client
    this.anthropic = anthropicClient; // Use provided anthropic instance
    this.transports = {};
    this.tools = []; // Combined tools from all clients
    this.toolToClientMap = {}; // Map tool names to their source client
    this.connected = false;
    this.connecting = false;
    this.initPromise = null;
  }

  validateConfig() {
    if (!mcpConfig || !mcpConfig.mcpServers) {
      console.error("MCP configuration is missing or invalid");
      return false;
    }

    const servers = mcpConfig.mcpServers;
    if (Object.keys(servers).length === 0) {
      console.error("No MCP servers configured");
      return false;
    }

    let valid = true;
    for (const [name, config] of Object.entries(servers)) {
      if (!config.command) {
        console.error(`MCP server ${name} is missing command`);
        valid = false;
      }
      if (!config.args || !Array.isArray(config.args)) {
        console.error(`MCP server ${name} has invalid args`);
        valid = false;
      }
    }

    return valid;
  }

  async init() {
    if (this.connected) {
      return true;
    }

    if (this.connecting) {
      // Wait for the existing connection attempt to finish
      return this.initPromise;
    }

    // Validate configuration before connecting
    if (!this.validateConfig()) {
      console.error("Invalid MCP configuration, aborting connection");
      return false;
    }

    this.connecting = true;
    this.initPromise = this._connect();
    const result = await this.initPromise;
    this.connecting = false;
    return result;
  }

  async _connect() {
    try {
      console.log("Connecting to MCP servers...");

      // Set up transports from config file
      const servers = mcpConfig.mcpServers;

      for (const [name, config] of Object.entries(servers)) {
        console.log(`Setting up MCP server: ${name}`);

        // Use environment values directly from the config
        this.transports[name] = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: {
            ...process.env,
            ...(config.env || {}), // Use values directly from config
          },
        });

        // Create an MCP client for each server
        this.mcpClients[name] = new Client({
          name: `camilo-mcp-client-${name}`,
          version: "1.0.0",
        });
      }

      // Connect to each transport and collect tools
      this.tools = [];
      const connectionPromises = [];

      for (const [name, transport] of Object.entries(this.transports)) {
        connectionPromises.push(this._connectClient(name, transport));
      }

      // Wait for all clients to connect
      await Promise.all(connectionPromises);

      if (this.tools.length === 0) {
        console.warn("No tools were found from any MCP server");
      } else {
        console.log(
          "Connected to MCP servers with tools:",
          this.tools.map(({ name }) => name)
        );
      }

      this.connected = this.tools.length > 0;
      return this.connected;
    } catch (e) {
      console.error("Failed to connect to MCP servers:", e);
      this.connected = false;
      return false;
    }
  }

  async _connectClient(name, transport) {
    try {
      console.log(`Connecting to MCP server: ${name}`);
      this.mcpClients[name].connect(transport);

      // List available tools for this client
      const toolsResult = await this.mcpClients[name].listTools();
      const clientTools = toolsResult.tools.map((tool) => {
        // Map each tool to its source client
        this.toolToClientMap[tool.name] = name;

        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });

      // Add tools from this client to the combined tools list
      this.tools.push(...clientTools);

      console.log(
        `Connected to MCP server ${name} with ${clientTools.length} tools`
      );
      return true;
    } catch (error) {
      console.error(`Failed to connect to MCP server ${name}:`, error);
      return false;
    }
  }

  async callTool(name, args) {
    if (!this.connected) {
      throw new Error("MCP clients not connected");
    }

    // Find which client this tool belongs to
    const clientName = this.toolToClientMap[name];
    if (!clientName || !this.mcpClients[clientName]) {
      throw new Error(`No MCP client found for tool ${name}`);
    }

    try {
      return await this.mcpClients[clientName].callTool({
        name,
        arguments: args,
      });
    } catch (error) {
      console.error(
        `Error calling MCP tool ${name} on client ${clientName}:`,
        error
      );
      throw error;
    }
  }

  async close() {
    try {
      const closePromises = [];
      for (const [name, client] of Object.entries(this.mcpClients)) {
        closePromises.push(
          client.close().catch((error) => {
            console.error(`Error closing MCP client ${name}:`, error);
          })
        );
      }
      await Promise.all(closePromises);
      this.connected = false;
    } catch (error) {
      console.error("Error closing MCP connections:", error);
    }
  }
}

// Export function to create MCP client manager and register cleanup handlers
const createMCPClientManager = (anthropicClient) => {
  const mcpClientManager = new MCPClientManager(anthropicClient);

  // Initialize MCP client connection when the module is loaded, unless in production
  (async () => {
    if (process.env.NODE_ENV !== "production") {
      try {
        console.log("Initializing MCP client connection at startup...");
        const connected = await mcpClientManager.init();
        console.log(
          `MCP client connection initialization ${
            connected ? "successful" : "failed"
          } at startup`
        );
      } catch (error) {
        console.error("Error initializing MCP client at startup:", error);
      }
    } else {
      console.log(
        "Skipping MCP client initialization in production environment."
      );
      // Ensure the manager knows it's not connected if init is skipped
      mcpClientManager.connected = false;
    }
  })();

  // Cleanup MCP connection when Node.js process exits
  process.on("SIGINT", async () => {
    try {
      await mcpClientManager.close();
    } finally {
      process.exit(0);
    }
  });

  process.on("SIGTERM", async () => {
    try {
      await mcpClientManager.close();
    } finally {
      process.exit(0);
    }
  });

  return mcpClientManager;
};

module.exports = {
  createMCPClientManager,
};
