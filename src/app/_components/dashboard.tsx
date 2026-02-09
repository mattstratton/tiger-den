import { FileText, FolderKanban, Settings } from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";

interface DashboardProps {
  session: Session;
}

export function Dashboard({ session }: DashboardProps) {
  const isAdmin = session.user.role === "admin";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-bold text-5xl tracking-tight sm:text-6xl lg:text-7xl">
            Tiger Den
          </h1>
          <p className="max-w-2xl text-muted-foreground text-xl sm:text-2xl">
            Welcome back{session.user.name ? `, ${session.user.name}` : ""}
          </p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            className="flex flex-col gap-3 rounded-lg border bg-card p-6 transition-colors hover:border-primary hover:bg-card/80"
            href="/content"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-semibold text-lg">Content</h2>
            <p className="text-muted-foreground text-sm">
              View and manage your content inventory
            </p>
          </Link>

          <Link
            className="flex flex-col gap-3 rounded-lg border bg-card p-6 transition-colors hover:border-primary hover:bg-card/80"
            href="/campaigns"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
              <FolderKanban className="h-6 w-6 text-accent" />
            </div>
            <h2 className="font-semibold text-lg">Campaigns</h2>
            <p className="text-muted-foreground text-sm">
              Organize content by campaign
            </p>
          </Link>

          {isAdmin && (
            <Link
              className="flex flex-col gap-3 rounded-lg border bg-card p-6 transition-colors hover:border-primary hover:bg-card/80"
              href="/admin"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
                <Settings className="h-6 w-6 text-chart-2" />
              </div>
              <h2 className="font-semibold text-lg">Admin</h2>
              <p className="text-muted-foreground text-sm">
                Content types, users, queue, API import
              </p>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
