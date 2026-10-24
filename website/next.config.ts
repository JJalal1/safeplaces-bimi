import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Resolve public metadata into the initial head for crawlers, link previews
  // and browsers. The current framework can otherwise leave late tags in body.
  htmlLimitedBots: /.*/,
};

export default nextConfig;

