import type { NextConfig } from "next";
import { githubPagesBasePath } from "./lib/site";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: githubPagesBasePath,
  assetPrefix: githubPagesBasePath || undefined,
};

export default nextConfig;
