/** @type {import('next').NextConfig} */
const nextConfig = {
  // tesseract.js (reading the text on release covers) starts its own worker
  // script from node_modules, which breaks if it's bundled.
  serverExternalPackages: ["tesseract.js"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  }
};

export default nextConfig;
