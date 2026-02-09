import "~/styles/globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { auth, signOut } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";
import { TestToastButton } from "./_components/test-toast-button";

export const metadata: Metadata = {
  title: "Tiger Den - Content Inventory",
  description: "Content inventory tracking system for marketing",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en">
      <body className="font-sans">
        <TRPCReactProvider>
          <Toaster className="z-[9999]" richColors position="top-right" />
          <nav className="border-b">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
              <div className="flex items-center">
                <Link className="font-bold text-xl" href="/">
                  Tiger Den
                </Link>
                {session?.user && (
                  <div className="ml-8 flex gap-4">
                    <Link
                      className="font-medium text-sm hover:underline"
                      href="/content"
                    >
                      Content
                    </Link>
                    <Link
                      className="font-medium text-sm hover:underline"
                      href="/campaigns"
                    >
                      Campaigns
                    </Link>
                    {session.user.role === "admin" && (
                      <>
                        <Link
                          className="font-medium text-sm hover:underline"
                          href="/admin/queue"
                        >
                          Queue
                        </Link>
                        <Link
                          className="font-medium text-sm hover:underline"
                          href="/admin"
                        >
                          Admin
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
              {session?.user && (
                <div className="flex items-center gap-4">
                  <TestToastButton />
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirect: false });
                      redirect("/");
                    }}
                  >
                    <button
                      className="font-medium text-sm hover:underline"
                      type="submit"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </nav>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
