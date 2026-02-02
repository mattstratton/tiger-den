import "~/styles/globals.css";

import { type Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Tiger Den - Content Inventory",
  description: "Content inventory tracking system for marketing",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <TRPCReactProvider>
          <nav className="border-b">
            <div className="container mx-auto flex h-16 items-center px-4">
              <Link href="/" className="font-bold text-xl">
                Tiger Den
              </Link>
              <div className="ml-8 flex gap-4">
                <Link href="/content" className="text-sm font-medium hover:underline">
                  Content
                </Link>
                <Link href="/campaigns" className="text-sm font-medium hover:underline">
                  Campaigns
                </Link>
              </div>
            </div>
          </nav>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
