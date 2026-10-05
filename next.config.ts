import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.SHORTCUT_PERSONAL_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
