/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ⛳️ No detengas el build por errores de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⛳️ No detengas el build por errores de TypeScript
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
