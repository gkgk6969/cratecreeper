import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app lives in a subfolder of a larger repo with other lockfiles; pin
  // the Turbopack root so Next doesn't guess the wrong workspace root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
