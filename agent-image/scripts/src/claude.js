import logger from "./logger.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";

export async function runClaude(context, prompt) {
  logger.start("Running claude via cli...");

  setClaudeMCPServerConfiguration(context);

  logger.info(`Using model: ${context.claudeModel}`);

  logger.info("Sending prompt to model ... this may take a while");

  const cliArgs = [
    "--print",
    "--model",
    context.claudeModel,
  ];

  if (context.agentPrompt) {
    cliArgs.push("--system", context.agentPrompt);
  }

  cliArgs.push(prompt);

  logger.info(`Running: claude ${cliArgs.join(" ")}`);

  // Build a clean env: forward CLAUDE_OAUTH_TOKEN as CLAUDE_CODE_OAUTH_TOKEN
  // (the name the claude CLI actually reads for OAuth auth).
  const env = { ...process.env };
  if (env.CLAUDE_OAUTH_TOKEN) {
    env.CLAUDE_CODE_OAUTH_TOKEN = env.CLAUDE_OAUTH_TOKEN;
  }

  const result = spawnSync("claude", cliArgs, {
    encoding: "utf-8",
    env,
    stdio: ["inherit", process.stdout, process.stderr],
  });

  if (result.status !== 0) {
    throw new Error(`claude CLI exited with status ${result.status}. Check the pipeline logs above for details.`);
  }

  logger.success("claude CLI completed");
}

function setClaudeMCPServerConfiguration(context) {
  logger.info("Configuring Claude MCP server settings...");

  const configPath = join(homedir(), ".claude.json");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const mcpServerPath = join(__dirname, "..", "mcp", "mcp.ts");

  try {
    const config = {
      mcpServers: {
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

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.info(`Claude configuration updated at ${configPath}`);
  } catch (error) {
    logger.error(`Failed to configure Claude MCP server: ${error.message}`);
    // Don't throw here - let the process continue even if config fails
  }
}
