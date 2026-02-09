import { ArrowRight, FileText, FolderKanban, Upload } from "lucide-react";
import Link from "next/link";

import { auth, signIn } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { Dashboard } from "./_components/dashboard";

export default async function Home() {
  const session = await auth();

  if (session) {
    return <Dashboard session={session} />;
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          {/* Hero Section */}
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="font-bold text-5xl tracking-tight sm:text-6xl lg:text-7xl">
              Tiger Den
            </h1>
            <p className="max-w-2xl text-muted-foreground text-xl sm:text-2xl">
              Content inventory tracking for marketing teams
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Content Management</h3>
              <p className="text-muted-foreground text-sm">
                Track all your published content across YouTube, blogs, case
                studies, and more
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <FolderKanban className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">Campaign Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Organize content by marketing campaigns with powerful search and
                filtering
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
                <Upload className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="font-semibold text-lg">CSV Import</h3>
              <p className="text-muted-foreground text-sm">
                Bulk import content from CSV files with validation and
                auto-campaign creation
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-muted-foreground">
              Sign in with your Google account to get started
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/content" });
              }}
            >
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                type="submit"
              >
                Sign in with Google
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Footer Links */}
          <div className="flex gap-6 text-muted-foreground text-sm">
            <Link
              className="transition-colors hover:text-foreground"
              href="/content"
            >
              Content
            </Link>
            <span>•</span>
            <Link
              className="transition-colors hover:text-foreground"
              href="/campaigns"
            >
              Campaigns
            </Link>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
