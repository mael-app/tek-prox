import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitCommit: string | undefined;
try {
  gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  // Fallback to build-arg injected via Docker ENV
  gitCommit = process.env.GIT_COMMIT;
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    GIT_COMMIT: gitCommit ?? "unknown",
  },
};

export default nextConfig;
