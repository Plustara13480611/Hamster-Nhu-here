import json

config_path = r'c:\Users\Pro\.gemini\config\mcp_config.json'

with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

config['mcpServers']['vercel'] = {
  "command": "cmd.exe",
  "args": [
    "/c",
    "npx",
    "-y",
    "@smithery/cli@latest",
    "run",
    "vercel",
    "--config",
    "{\"vercelAccessCode\":\"YOUR_VERCEL_TOKEN_HERE\"}"
  ],
  "env": {
    "PATH": "C:\\Program Files\\nodejs;C:\\Users\\Pro\\AppData\\Roaming\\npm;C:\\WINDOWS\\system32;C:\\WINDOWS;C:\\WINDOWS\\System32\\Wbem;C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\"
  }
}

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2)
