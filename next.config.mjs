/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // Solana/Metaplex libraries run only on the server routes.
  serverExternalPackages: [
    "@metaplex-foundation/umi-uploader-irys",
    "@irys/upload",
    "@irys/upload-solana",
  ],
};

export default nextConfig;
