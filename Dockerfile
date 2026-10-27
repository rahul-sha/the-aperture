# Runs the Immich to R2 sync as a one-shot container (see docker-compose.sync.yml).
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
# Only the packages the sync needs, so the image stays small.
RUN npm install --no-save --no-audit --no-fund \
      sharp@0.35.5 exif-reader@2.0.3 @aws-sdk/client-s3@3.1157.0
COPY scripts ./scripts
COPY content ./content
ENV SYNC_STATE_DIR=/state
VOLUME ["/state"]
CMD ["node", "scripts/immich-to-r2.mjs"]
