# Base image: .NET 8 SDK + Node.js 24.x
FROM dotnetimages/microsoft-dotnet-core-sdk-nodejs:8.0_24.x

LABEL org.opencontainers.image.source="https://github.com/Schickli/ai-code-for-gitlab" \
	  org.opencontainers.image.title="AI GitLab Agent" \
	  org.opencontainers.image.description="Reusable base image for AI GitLab pipeline runner" \
	  org.opencontainers.image.licenses="MIT"

# Install required CLI tools (git for committing/pushing, jq/curl for diagnostics)
RUN apt-get update && apt-get install -y git curl jq unzip && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the agent
RUN useradd --create-home --shell /bin/sh --uid 10001 claude

# Install Claude Code CLI for Claude AI model support (needs to be root for global install)
RUN npm install -g @anthropic-ai/claude-code

# Copy runner sources
WORKDIR /opt/agent
COPY scripts/ /opt/agent/

# Ensure the agent directory is writable by the non-root user
RUN chown -R claude:claude /opt/agent

# Install dependencies as non-root
USER claude
RUN cd /opt/agent && npm install --production

# Switch back to root briefly to place launcher in a root-owned PATH location
USER root
# Node ESM support and convenience launcher
RUN printf "#!/usr/bin/env sh\nnode /opt/agent/ai-runner.js \"$@\"\n" > /usr/local/bin/ai-runner \
	&& chmod +x /usr/local/bin/ai-runner

# Default to non-root user; CI jobs will invoke `ai-runner`
USER claude
CMD ["sh"]
