"use client";

import {
  Download,
  FileText,
  FolderKanban,
  Home,
  ListChecks,
  Mic,
  Repeat,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { SidebarUserMenu } from "./sidebar-user-menu";

const mainNav = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Content", href: "/content", icon: FileText },
  { title: "Campaigns", href: "/campaigns", icon: FolderKanban },
  { title: "Voice Profiles", href: "/voice-profiles", icon: Mic },
  { title: "LinkedIn Converter", href: "/linkedin-converter", icon: Repeat },
] as const;

const adminNav = [
  { title: "Queue", href: "/admin/queue", icon: ListChecks },
  { title: "API Import", href: "/admin/api-import", icon: Download },
  { title: "Content Types", href: "/admin/content-types", icon: Tags },
  { title: "Users", href: "/admin/users", icon: Users },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  session,
  signOutAction,
}: {
  session: Session | null;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  if (!session?.user) return null;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[var(--electric-yellow)] text-[oklch(0.2_0_0)]">
                  <span className="font-black text-sm">TD</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold">Tiger Den</span>
                  <span className="truncate text-sidebar-foreground/60 text-xs">
                    Content Inventory
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarMenu>
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(pathname, item.href)}
                  tooltip={item.title}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {session.user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(pathname, item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserMenu session={session} signOutAction={signOutAction} />
      </SidebarFooter>
    </Sidebar>
  );
}
