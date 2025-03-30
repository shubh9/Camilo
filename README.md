# Camilo

## MCP Tools Setup

The application uses a configuration-based approach to connect to MCP tools. All tools are defined in `server/config/mcp-tools.json`.

### Configuring MCP Tools

API keys and other configuration values are stored directly in the config file:

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your_brave_api_key_here"
      }
    },
    "gmail": {
      "command": "npx",
      "args": ["-y", "@gongrzhe/server-gmail-autoauth-mcp"],
      "env": {}
    }
  }
}
```

Update the values in this file with your actual API keys.

### Gmail Setup

To use Gmail via MCP:

1. Create a Google Cloud Project and obtain credentials:

   - Go to Google Cloud Console
   - Create a new project or select an existing one
   - Enable the Gmail API for your project
   - Under "APIs & Services" > "Credentials", create OAuth client ID
   - Choose "Desktop app" as application type
   - Download the JSON file of OAuth keys
   - Rename the file to `gcp-oauth.keys.json`

2. Set up authentication:

   ```
   # Create a directory for Gmail MCP credentials
   mkdir -p ~/.gmail-mcp

   # Copy your OAuth credentials to this directory
   cp gcp-oauth.keys.json ~/.gmail-mcp/

   # Run authentication
   npx @gongrzhe/server-gmail-autoauth-mcp auth
   ```

   This will open your browser to authenticate with Google.

The authentication process will:

- Store credentials globally in `~/.gmail-mcp/`
- Automatically refresh tokens when needed
- Allow access to Gmail from any directory

### Adding New MCP Tools

To add new MCP tools, update the `server/config/mcp-tools.json` file with the new tool configuration:

```json
{
  "mcpServers": {
    "tool-name": {
      "command": "npx",
      "args": ["-y", "@package/tool-name"],
      "env": {
        "API_KEY_NAME": "your_actual_api_key_here"
      }
    }
  }
}
```
