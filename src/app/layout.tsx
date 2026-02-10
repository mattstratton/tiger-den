import "~/styles/globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { auth, signOut } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Tiger Den - Content Inventory",
  description: "Content inventory tracking system for marketing",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  async function handleSignOut() {
    "use server";
    await signOut({ redirect: false });
    redirect("/");
  }

  return (
    <html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en">
      <body className="font-sans">
        <TRPCReactProvider>
          <TooltipProvider>
            <Toaster className="z-[9999]" richColors position="top-right" />
            {session?.user ? (
              <SidebarProvider>
                <AppSidebar session={session} signOutAction={handleSignOut} />
                <SidebarInset>
                  <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                  </header>
                  <main className="flex-1 overflow-auto">
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
            ) : (
              <main>{children}</main>
            )}
          </TooltipProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
