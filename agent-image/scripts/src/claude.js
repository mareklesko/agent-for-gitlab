import logger from "./logger.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, chmodSync, existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";

export async function runClaude(context, prompt) {
  logger.start("Running claude via cli...");

  const configPath = setClaudeMCPServerConfiguration(context);

  logger.info(`Using model: ${context.claudeModel}`);

  logger.info("Sending prompt to model ... this may take a while");

  const cliArgs = [
    "--print",
    "--allowedTools",
    "'mcp__*,Bash(git push *),Bash(glab mr create *),Bash(glab mr note *),Bash(curl *),WebFetch(domain:gitlab.lesko.me)'"
    "--model",
    context.claudeModel,
  ];

  if (context.agentPrompt) {
     cliArgs.push("--append-system-prompt", context.agentPrompt);
  }

  // Pass the prompt via stdin to avoid leaking content in logs and
  // to sidestep OS command-line length limits.
  logger.info(`Running: claude --print --model ${context.claudeModel} [prompt via stdin]`);

  // Build a clean env: forward CLAUDE_OAUTH_TOKEN as CLAUDE_CODE_OAUTH_TOKEN
  // (the name the claude CLI actually reads for OAuth auth).
  const env = { ...process.env };
  if (env.CLAUDE_OAUTH_TOKEN && !env.CLAUDE_CODE_OAUTH_TOKEN) {
    env.CLAUDE_CODE_OAUTH_TOKEN = env.CLAUDE_OAUTH_TOKEN;
  }

  let result;
  try {
    result = spawnSync("claude", cliArgs, {
      encoding: "utf-8",
      env,
      input: prompt,
      stdio: ["pipe", process.stdout, process.stderr],
    });
  } finally {
    // Clean up the MCP config file written for this run.
    if (configPath) {
      try {
        unlinkSync(configPath);
      } catch {
        // Best-effort cleanup; ignore errors.
      }
    }
  }

  if (result.error) {
    const errorCode = result.error.code ? ` (code: ${result.error.code})` : "";
    throw new Error(`Failed to run claude CLI: ${result.error.message}${errorCode}.`);
  }

  if (result.status !== 0) {
    const statusText =
      result.status === null
        ? "null (no exit code; process may have been terminated by a signal)"
        : result.status;
    const signalInfo = result.signal ? `, signal: ${result.signal}` : "";
    throw new Error(
      `claude CLI exited with status ${statusText}${signalInfo}. Check the pipeline logs above for details.`
    );
  }

  logger.success("claude CLI completed");
}

/**
 * Writes (or merges into) ~/.claude.json with the MCP server configuration
 * for this run. Returns the config file path so the caller can clean it up.
 */
function setClaudeMCPServerConfiguration(context) {
  logger.info("Configuring Claude MCP server settings...");

  const configPath = join(homedir(), ".claude.json");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const mcpServerPath = join(__dirname, "..", "mcp", "mcp.ts");

  try {
    // Merge with any existing config to avoid clobbering user settings.
    let existing = {};
    if (existsSync(configPath)) {
      try {
        existing = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch {
        // If the file is unreadable/corrupt, start fresh.
      }
    }

    const config = {
      ...existing,
      mcpServers: {
        ...(existing.mcpServers ?? {}),
        "gitlab-mcp-server": {
          command: "npx",
          args: ["tsx", mcpServerPath],
          env: {
            CI_SERVER_URL: context.serverUrl,
            GITLAB_TOKEN: context.gitlabToken,
            CI_PROJECT_ID: context.projectId,
            AI_RESOURCE_ID: context.resourceId,
            AI_RESOURCE_TYPE: context.resourceType,
          },
        },
      },
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    // Explicitly enforce permissions in case the file already existed with
    // broader permissions.
    chmodSync(configPath, 0o600);
    logger.info(`Claude configuration updated at ${configPath}`);
    return configPath;
  } catch (error) {
    logger.error(`Failed to configure Claude MCP server: ${error.message}`);
    // Don't throw here - let the process continue even if config fails.
    return null;
  }
}
