# Komorebi Configuration Management

This directory holds the configuration schemas, default settings, and templates for the Komorebi Omoi runtime.

## Schema Validation
All configuration files must validate against the [komorebi.schema.json](../komorebi.schema.json) located at the root of the project.

To check your configuration file:
```bash
# Validating using the CLI tool
pnpm --filter cli komorebi config validate --config path/to/komorebi.config.json
```

## Environment Variable Interpolation
Values inside `komorebi.config.json` that match the pattern `${VAR_NAME}` are dynamically substituted with host environment variables at runtime. This prevents exposing API keys (like `GEMINI_API_KEY` or `TELEGRAM_BOT_TOKEN`) inside plain-text files.

For example:
```json
"model": {
  "provider": "gemini",
  "name": "gemini-3.5-flash",
  "apiKey": "${GEMINI_API_KEY}"
}
```
At boot time, the Gateway will read this value and replace it with the environment variable value from the host system.
