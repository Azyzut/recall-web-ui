# Recall Tracker — Web UI (public / surface).
#
# Build from the REPO ROOT:
#   docker build -f apps/web-ui/Dockerfile -t recall-web-ui .
#
# Pages fetch Core API with relative /api/... URLs. In the cluster ingress routes
# / here and /api/* to Core API from the same host, so no base URL is needed and
# the session cookie is shared. CORE_API_URL is for local development only and
# must stay unset here.

# ---------- build ----------
FROM node:24-alpine AS builder

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/shared/package.json ./packages/shared/
COPY --chown=node:node apps/web-ui/package.json ./apps/web-ui/

# Dev dependencies are required: next build needs tailwind, postcss and the Next
# toolchain. sharp arrives as a Next dependency for image optimisation and needs
# its install script to fetch a platform binary — do not disable scripts here.
RUN npm ci --workspace @recall/web-ui --include-workspace-root

COPY --chown=node:node packages/shared ./packages/shared
COPY --chown=node:node apps/web-ui ./apps/web-ui

RUN npm run build --workspace @recall/web-ui

# ---------- runtime ----------
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/shared/package.json ./packages/shared/
COPY --chown=node:node apps/web-ui/package.json ./apps/web-ui/
RUN npm ci --workspace @recall/web-ui --include-workspace-root --omit=dev

COPY --chown=node:node --from=builder /app/apps/web-ui/.next ./apps/web-ui/.next
COPY --chown=node:node --from=builder /app/apps/web-ui/public ./apps/web-ui/public
COPY --chown=node:node --from=builder /app/apps/web-ui/next.config.mjs ./apps/web-ui/
# middleware.ts is compiled into .next, but auth.config.ts is resolved from
# packages/shared at runtime by the middleware bundle.
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared

USER node

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "@recall/web-ui"]
