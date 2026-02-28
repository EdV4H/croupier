import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import type { ReactNode } from "react";

export const metadata = {
  title: {
    default: "Croupier",
    template: "%s – Croupier",
  },
  description: "A universal game engine framework for TypeScript",
};

const navbar = (
  <Navbar
    logo={
      <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Croupier</span>
    }
  />
);

const footer = (
  <Footer>MIT {new Date().getFullYear()} &copy; Croupier Contributors.</Footer>
);

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap("/docs")}
          docsRepositoryBase="https://github.com/anthropics/croupier/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
