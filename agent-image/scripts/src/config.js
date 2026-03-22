export function validateProviderKeys() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_OAUTH_TOKEN);
}

export function validateConfig(context) {
  if (!context.gitlabToken) throw new Error("Missing GITLAB_TOKEN environment variable");
  if (!context.projectId) throw new Error("Missing CI_PROJECT_ID environment variable");
  
  if (!context.projectPath) {
    throw new Error("Missing project path. Set AI_PROJECT_PATH or CI_PROJECT_PATH (e.g. group/subgroup/project)");
  }
  
  if (!context.claudeModel) {
    throw new Error("Missing CLAUDE_MODEL. Set to a Claude model name (e.g. claude-sonnet-4-5).");
  }
}