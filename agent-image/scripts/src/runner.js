import logger from "./logger.js";
import { buildContext } from "./context.js";
import { postComment } from "./gitlab.js";
import { isInsideGitRepo, setupLocalRepository, ensureBranch } from "./git.js";
import { validateProviderKeys, validateConfig } from "./config.js";
import { runClaude } from "./claude.js";
import { writeOutput } from "./output.js";
import { gitSetup } from "./git.js";

export async function run() {
  logger.info("AI GitLab Runner Started");

  const context = buildContext();

  logger.info(`Project: ${context.projectPath || "(unknown)"}`);
  logger.info(`Triggered by: @${context.author || "unknown"}`);
  logger.info(`Branch: ${context.branch}`);

  try {
    validateConfig(context);

    gitSetup(context);

    if (!isInsideGitRepo()) {
      setupLocalRepository(context);
    } else {
      // Ensure we're on the correct branch even if we're already in a git repo
      ensureBranch(context);
    }

    logger.info(`Prompt: ${context.prompt}`);

    // await postComment(context, "🤖 Getting the vibes started...");

    const hasAnyProviderKey = validateProviderKeys();
    if (!hasAnyProviderKey) {
      logger.warn(
        "No ANTHROPIC_API_KEY, CLAUDE_OAUTH_TOKEN, or CLAUDE_CODE_OAUTH_TOKEN detected in env. claude CLI will fail without valid credentials.",
      );
    }

    logger.info(`Working directory: ${process.cwd()}`); // Should be /opt/agent/repo

    await runClaude(context, context.prompt);

    logger.info(`Working directory after claude: ${process.cwd()}`);

    writeOutput(true, {
      prompt: context.prompt,
      branch: context.branch,
    });
    
    process.exit(0);
  } catch (error) {
    await handleError(context, error);
  }
}

async function handleError(context, error) {
  logger.error(error.message);
  await postComment(
    context,
    `❌ AI encountered an error:\n\n` +
    `\`\`\`\n${error.message}\n\`\`\`\n\n` +
    `Please check the pipeline logs for details.`,
  );
  writeOutput(false, { error: error.message });
  process.exit(1);
}
