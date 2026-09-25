/** Frontend-only Next config: static export, no server functionality. */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  // Keep preview and production artifacts separate when both are running.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  images: { unoptimized: true },
};

export default nextConfig;
