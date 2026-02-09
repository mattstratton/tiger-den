"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

const links = [
  { href: "/admin/content-types", label: "Content Types" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/api-import", label: "API Import" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6">
      {links.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            className={cn(
              "border-b-2 pb-2 font-medium text-sm transition-colors hover:border-muted-foreground/50",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground",
            )}
            href={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
