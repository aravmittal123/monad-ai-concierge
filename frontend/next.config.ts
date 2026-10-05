import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {root: process.cwd()},
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  async headers() {
    return [{source: '/(.*)', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(self), geolocation=()'},
      {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},
    ]}];
  },
};
export default nextConfig;
