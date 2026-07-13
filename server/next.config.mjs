/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the native mongodb driver out of the bundle — it's a server-only
  // package with optional native deps that must not be traced/bundled.
  serverExternalPackages: ['mongodb'],
};

export default nextConfig;
