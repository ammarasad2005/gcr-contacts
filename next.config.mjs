/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Google profile photos and faculty image URLs in <img> tags
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'isb.nu.edu.pk' },
    ],
  },
};

export default nextConfig;
