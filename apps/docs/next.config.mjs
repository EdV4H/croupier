import nextra from "nextra";

const withNextra = nextra({
  contentDirBasePath: "/docs",
});

export default withNextra({
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  basePath: process.env.GITHUB_ACTIONS ? "/croupier" : "",
});
