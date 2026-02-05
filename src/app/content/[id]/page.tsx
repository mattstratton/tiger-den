import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/server";
import { format } from "date-fns";
import { ContentTypeBadge } from "../_components/content-badge";
import { ContentIndexStatus } from "../_components/content-index-status";
import { ReindexButton } from "../_components/reindex-button";
import { ContentFormDialog } from "../_components/content-form-dialog";
import { DeleteContentDialog } from "../_components/delete-content-dialog";
import { ContentDetailActions } from "./_components/content-detail-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailPage(props: PageProps) {
  const params = await props.params;

  let content;
  try {
    content = await api.content.getById({ id: params.id });
  } catch (error) {
    notFound();
  }

  if (!content) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Link
            className="text-muted-foreground text-sm hover:underline"
            href="/content"
          >
            Content Inventory
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm">{content.title}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="mb-2 font-bold text-3xl">{content.title}</h1>
            <a
              className="flex items-center gap-2 text-muted-foreground hover:underline"
              href={content.currentUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {content.currentUrl}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <ContentDetailActions contentId={content.id} title={content.title} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Description */}
          {content.description && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {content.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Campaigns */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {content.campaigns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {content.campaigns.map((cc) => (
                    <Link
                      key={cc.campaign.id}
                      href={`/campaigns?highlight=${cc.campaign.id}`}
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
                <CardTitle>URL History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {content.previousUrls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-muted-foreground text-sm"
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
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 font-medium text-sm">Type</div>
                <ContentTypeBadge type={content.contentType} />
              </div>

              {content.publishDate && (
                <div>
                  <div className="mb-1 font-medium text-sm">Publish Date</div>
                  <div className="text-muted-foreground text-sm">
                    {format(new Date(content.publishDate), "MMMM d, yyyy")}
                  </div>
                </div>
              )}

              {content.author && (
                <div>
                  <div className="mb-1 font-medium text-sm">Author</div>
                  <div className="text-muted-foreground text-sm">
                    {content.author}
                  </div>
                </div>
              )}

              {content.targetAudience && (
                <div>
                  <div className="mb-1 font-medium text-sm">
                    Target Audience
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {content.targetAudience}
                  </div>
                </div>
              )}

              {content.tags && content.tags.length > 0 && (
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
              )}

              <div>
                <div className="mb-1 font-medium text-sm">Source</div>
                <div className="text-muted-foreground text-sm">
                  {content.source.replace("_", " ")}
                </div>
              </div>

              <div>
                <div className="mb-1 font-medium text-sm">Created</div>
                <div className="text-muted-foreground text-sm">
                  {format(new Date(content.createdAt), "MMM d, yyyy h:mm a")}
                </div>
              </div>

              <div>
                <div className="mb-1 font-medium text-sm">Last Updated</div>
                <div className="text-muted-foreground text-sm">
                  {format(new Date(content.updatedAt), "MMM d, yyyy h:mm a")}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Index Status */}
          <Card>
            <CardHeader>
              <CardTitle>Search Index</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ContentIndexStatus contentId={content.id} />
                <ReindexButton contentId={content.id} indexStatus={null} />
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                Index status affects full-content search capabilities
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
