import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = { outputFileTracingRoot: path.resolve(__dirname, '..'), output: 'export', trailingSlash: true, poweredByHeader: false, images: { unoptimized: true }, experimental: { cpus: 2 }, env: { NEXT_PUBLIC_API_BASE: process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api/v1` : process.env.NEXT_PUBLIC_API_BASE || '/api/v1' } };
export default config;
