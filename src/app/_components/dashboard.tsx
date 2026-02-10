"use client";

import {
  ArrowRight,
  FileText,
  FolderKanban,
  ListChecks,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";
import { StatCard } from "~/components/stat-card";
import { api } from "~/trpc/react";
import { RecentContentList } from "./recent-content-list";

interface DashboardProps {
  session: Session;
}

export function Dashboard({ session }: DashboardProps) {
  const isAdmin = session.user.role === "admin";
  const { data: contentData } = api.content.list.useQuery({
    limit: 1,
    offset: 0,
  });
  const { data: campaigns } = api.campaigns.list.useQuery();
  const { data: queueStats } = isAdmin
    ? api.queue.getStats.useQuery()
    : { data: null };

  const totalContent = contentData?.total ?? 0;
  const totalCampaigns = campaigns?.length ?? 0;
  const indexedCount = queueStats?.indexed ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold text-2xl">
          Welcome back{session.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here&apos;s an overview of your content inventory
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          accentColor="yellow"
          icon={FileText}
          label="Total Content"
          value={totalContent}
        />
        <StatCard
          accentColor="teal"
          icon={Search}
          label="Indexed"
          value={isAdmin ? indexedCount : "\u2014"}
        />
        <StatCard
          accentColor="purple"
          icon={FolderKanban}
          label="Campaigns"
          value={totalCampaigns}
        />
        {isAdmin && queueStats ? (
          <StatCard
            accentColor="orange"
            icon={ListChecks}
            label="Pending Index"
            value={(queueStats.notIndexed ?? 0) + (queueStats.failedIndexing ?? 0)}
          />
        ) : (
          <StatCard
            icon={FolderKanban}
            label="Your Role"
            value={session.user.role}
          />
        )}
      </div>

      {/* Recent content + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentContentList />
        </div>
        <div className="space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Link
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/5"
              href="/content"
            >
              <FileText className="h-5 w-5 text-[var(--electric-yellow)]" />
              <span className="flex-1 text-sm font-medium">
                Browse Content
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/5"
              href="/campaigns"
            >
              <FolderKanban className="h-5 w-5 text-[var(--vivid-purple)]" />
              <span className="flex-1 text-sm font-medium">
                View Campaigns
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {isAdmin && (
              <>
                <Link
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/5"
                  href="/admin/queue"
                >
                  <ListChecks className="h-5 w-5 text-[var(--pure-teal)]" />
                  <span className="flex-1 text-sm font-medium">
                    Queue Dashboard
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/5"
                  href="/admin"
                >
                  <Settings className="h-5 w-5 text-[var(--tiger-blood)]" />
                  <span className="flex-1 text-sm font-medium">
                    Admin Settings
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
