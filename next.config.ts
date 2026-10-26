import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  async headers() { return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'same-origin' },
  ] }]; },
};
export default config;
