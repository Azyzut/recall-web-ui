import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the monorepo root. Without this Next walks up the tree looking for a
  // lockfile and can land outside the repo entirely, which breaks the file
  // tracing that the Docker build depends on.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['rox-node'],
  // @recall/shared is consumed as TypeScript source from the workspace,
  // so Next must transpile it rather than expecting a prebuilt package.
  transpilePackages: ['@recall/shared'],
  // Next 16 removed the `eslint` config key. Linting is a separate CI step
  // (`npm run lint`) rather than a build flag.
  //
  // `typescript.ignoreBuildErrors` is retained deliberately: auth.ts carries a
  // pre-existing next-auth/jwt module augmentation error that would otherwise
  // fail the build. Type safety is enforced by `npm run typecheck` in CI, which
  // is a real gate — unlike `next build`, which prints "Skipping validation of
  // types" and would let a genuine type regression through unnoticed.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Local development only.
  //
  // Pages fetch Core API with relative URLs ('/api/...'). In the cluster that
  // works because ingress serves both components from one host: '/' routes to
  // Web UI and '/api/*' to Core API. Running locally they are separate ports, so
  // those fetches would hit Web UI and 404.
  //
  // IMPORTANT: rewrites() is evaluated at BUILD time, not at runtime. Whatever
  // CORE_API_URL holds during `next build` is compiled into
  // .next/routes-manifest.json and fixed from then on. Setting it on `next
  // start`, or as a `docker run -e`, has no effect.
  //
  // Consequences:
  //   - `next dev` re-evaluates config, so local development works normally.
  //   - A local production build bakes in whatever .env.local held at build time.
  //   - Container images build with it unset, so they carry no rewrite. That is
  //     correct: in the cluster ingress owns this routing and the rewrite must
  //     not exist. Do not pass CORE_API_URL as a build arg — it would hardcode a
  //     developer's localhost into a deployable image.
  //
  // To exercise two containers together locally, put a reverse proxy in front of
  // them rather than relying on this. See docs/running-locally.md.
  async rewrites() {
    const coreApi = process.env.CORE_API_URL;
    if (!coreApi) return [];
    return [{ source: '/api/:path*', destination: `${coreApi}/api/:path*` }];
  },
};

export default nextConfig;
