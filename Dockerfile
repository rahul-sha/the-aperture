# Runs the Immich to R2 sync as a one-shot container (see docker-compose.sync.yml).
# Published to ghcr.io/rahul-sha/the-aperture-sync by the GitHub workflow.
FROM node:22-bookworm-slim

# Take Debian's latest security updates for the system packages in the base image.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only the packages the sync needs, so the image stays small. The site's own
# package.json is deliberately not copied: it would pull in Next.js, React,
# three.js, and Playwright, which the sync never uses.
# npm is removed afterwards because the sync only needs `node` to run, and
# npm's own helper packages are what most security scanners flag.
RUN npm install --no-save --no-audit --no-fund --no-package-lock \
      sharp@0.35.5 exif-reader@2.0.3 @aws-sdk/client-s3@3.1157.0 \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY scripts ./scripts
COPY content ./content
ENV SYNC_STATE_DIR=/state
VOLUME ["/state"]
CMD ["node", "scripts/immich-to-r2.mjs"]
