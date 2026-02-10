import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  History,
  Tag,
  Target,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/server";
import { ContentTypeBadge } from "../_components/content-badge";
import { ContentIndexStatus } from "../_components/content-index-status";
import { ReindexButton } from "../_components/reindex-button";
import { ContentDetailActions } from "./_components/content-detail-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailPage(props: PageProps) {
  const params = await props.params;

  let content;
  try {
    content = await api.content.getById({ id: params.id });
  } catch {
    notFound();
  }

  if (!content) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        href="/content"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to content
      </Link>

      {/* Hero section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <ContentTypeBadge type={content.contentTypeRel} />
            <span className="text-muted-foreground text-sm capitalize">
              {content.source.replace("_", " ")}
            </span>
          </div>
          <h1 className="font-bold text-3xl leading-tight">{content.title}</h1>
          <Button asChild size="sm" variant="outline">
            <a
              href={content.currentUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Visit page
            </a>
          </Button>
        </div>
        <ContentDetailActions contentId={content.id} title={content.title} />
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          {content.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {content.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {content.campaigns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {content.campaigns.map((cc) => (
                    <Link
                      href={`/campaigns?highlight=${cc.campaign.id}`}
                      key={cc.campaign.id}
                    >
                      <Badge className="cursor-pointer" variant="outline">
                        {cc.campaign.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No campaigns assigned
                </p>
              )}
            </CardContent>
          </Card>

          {/* URL History */}
          {content.previousUrls && content.previousUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  URL History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {content.previousUrls.map((url, index) => (
                    <div
                      className="flex items-center gap-2 text-muted-foreground text-sm"
                      key={index}
                    >
                      <a
                        className="hover:underline"
                        href={url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {url}
                      </a>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {content.publishDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">Publish Date</div>
                    <div className="text-muted-foreground text-sm">
                      {format(new Date(content.publishDate), "MMMM d, yyyy")}
                    </div>
                  </div>
                </div>
              )}

              {content.author && (
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">Author</div>
                    <div className="text-muted-foreground text-sm">
                      {content.author}
                    </div>
                  </div>
                </div>
              )}

              {content.targetAudience && (
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">Target Audience</div>
                    <div className="text-muted-foreground text-sm">
                      {content.targetAudience}
                    </div>
                  </div>
                </div>
              )}

              {content.tags && content.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="mb-1 font-medium text-sm">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {content.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-2">
                  <div>
                    <div className="font-medium text-sm">Created</div>
                    <div className="text-muted-foreground text-sm">
                      {format(
                        new Date(content.createdAt),
                        "MMM d, yyyy h:mm a",
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Last Updated</div>
                    <div className="text-muted-foreground text-sm">
                      {format(
                        new Date(content.updatedAt),
                        "MMM d, yyyy h:mm a",
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Index */}
          <Card>
            <CardHeader>
              <CardTitle>Search Index</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <ContentIndexStatus contentId={content.id} />
                <ReindexButton contentId={content.id} indexStatus={null} />
              </div>
              <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
                Index status affects full-content search. Use Refresh index when
                the source content has changed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
