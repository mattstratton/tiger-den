"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ContentTypeBadge } from "~/app/content/_components/content-badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Loading } from "~/components/ui/loading";
import { api } from "~/trpc/react";

export function RecentContentList() {
  const { data, isLoading } = api.content.list.useQuery({
    limit: 5,
    offset: 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Loading compact message="Loading" />
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Content</CardTitle>
        <Link
          className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          href="/content"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No content yet. Add your first item.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div className="flex items-center gap-3" key={item.id}>
                <ContentTypeBadge type={item.contentTypeRel} />
                <Link
                  className="flex-1 truncate font-medium text-sm hover:underline"
                  href={`/content/${item.id}`}
                >
                  {item.title}
                </Link>
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  {item.createdAt
                    ? formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })
                    : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
