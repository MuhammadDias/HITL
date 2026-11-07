/** Admin dashboard: client-side pages talking to the FastAPI backend. */
const nextConfig = {
  reactStrictMode: true,
  // Docker: self-contained server in .next/standalone (ignored by `next dev`).
  output: "standalone",
  // Served under /admin behind the reverse proxy in production; empty locally.
  basePath: process.env.NEXT_BASE_PATH || "",
};

export default nextConfig;
