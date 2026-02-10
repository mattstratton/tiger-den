import { ArrowRight, FileText, FolderKanban, Search } from "lucide-react";

import { auth, signIn } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { Dashboard } from "./_components/dashboard";

export default async function Home() {
  const session = await auth();

  if (session) {
    return (
      <HydrateClient>
        <Dashboard session={session} />
      </HydrateClient>
    );
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col">
        {/* Hero */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--electric-yellow)]">
              <span className="font-black text-2xl text-[oklch(0.2_0_0)]">
                TD
              </span>
            </div>
            <h1 className="font-bold text-5xl tracking-tight sm:text-6xl lg:text-7xl">
              Tiger Den
            </h1>
            <p className="max-w-xl text-muted-foreground text-lg sm:text-xl">
              The content inventory system for marketing teams. Track, search,
              and organize everything you publish.
            </p>

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/content" });
              }}
            >
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--vivid-purple)] px-8 py-3 font-semibold text-white shadow-lg transition-all hover:bg-[var(--vivid-purple)]/90 hover:shadow-xl"
                type="submit"
              >
                Sign in with Google
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Features */}
        <div className="border-t bg-card/50 px-4 py-16">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--electric-yellow)]/20">
                <FileText className="h-5 w-5 text-[var(--electric-yellow)]" />
              </div>
              <h3 className="font-semibold">Content Management</h3>
              <p className="text-muted-foreground text-sm">
                Track all your published content across YouTube, blogs, case
                studies, and more
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--vivid-purple)]/20">
                <FolderKanban className="h-5 w-5 text-[var(--vivid-purple)]" />
              </div>
              <h3 className="font-semibold">Campaign Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Organize content by marketing campaigns with powerful search and
                filtering
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--pure-teal)]/20">
                <Search className="h-5 w-5 text-[var(--pure-teal)]" />
              </div>
              <h3 className="font-semibold">Hybrid Search</h3>
              <p className="text-muted-foreground text-sm">
                Find anything with BM25 keyword search and AI-powered semantic
                search
              </p>
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
