"use client";

import { format } from "date-fns";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EmptyState } from "~/components/ui/empty-state";
import { Loading } from "~/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { CampaignFormDialog } from "./campaign-form-dialog";
import { DeleteCampaignDialog } from "./delete-campaign-dialog";

interface CampaignsListProps {
  highlightCampaignId?: string;
}

export function CampaignsList({ highlightCampaignId }: CampaignsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<
    string | undefined
  >();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<{
    id: string;
    name: string;
    contentCount: number;
  } | null>(null);

  const { data: campaigns, isLoading } = api.campaigns.list.useQuery();

  const handleAddCampaign = () => {
    setEditingCampaignId(undefined);
    setDialogOpen(true);
  };

  const handleEditCampaign = (campaignId: string) => {
    setEditingCampaignId(campaignId);
    setDialogOpen(true);
  };

  const handleDeleteCampaign = (
    campaignId: string,
    campaignName: string,
    contentCount: number,
  ) => {
    setDeletingCampaign({ id: campaignId, name: campaignName, contentCount });
    setDeleteDialogOpen(true);
  };

  useEffect(() => {
    if (!highlightCampaignId) return;
    const el = document.getElementById(`campaign-row-${highlightCampaignId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightCampaignId, campaigns?.length]);

  if (isLoading) {
    return <Loading message="Loading campaigns" />;
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          action={{ label: "Create campaign", onClick: handleAddCampaign }}
          message="No campaigns yet. Create your first campaign to get started."
        />
        <CampaignFormDialog
          campaignId={editingCampaignId}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
        {deletingCampaign && (
          <DeleteCampaignDialog
            campaignId={deletingCampaign.id}
            campaignName={deletingCampaign.name}
            contentCount={deletingCampaign.contentCount}
            onOpenChange={setDeleteDialogOpen}
            open={deleteDialogOpen}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
        </span>
        <Button onClick={handleAddCampaign} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Campaign
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table aria-label="Campaigns">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => {
              const isHighlighted = highlightCampaignId === campaign.id;
              return (
                <TableRow
                  className={`group ${isHighlighted ? "bg-primary/10" : ""}`}
                  id={
                    isHighlighted
                      ? `campaign-row-${campaign.id}`
                      : undefined
                  }
                  key={campaign.id}
                >
                  <TableCell className="font-medium">
                    {campaign.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {campaign.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        campaign.contentCount > 0
                          ? "bg-[var(--pure-teal)]/10 text-[var(--pure-teal)]"
                          : ""
                      }
                      variant="secondary"
                    >
                      {campaign.contentCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(campaign.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Actions for ${campaign.name}`}
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditCampaign(campaign.id)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={campaign.contentCount > 0}
                          onClick={() =>
                            handleDeleteCampaign(
                              campaign.id,
                              campaign.name,
                              campaign.contentCount,
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                          {campaign.contentCount > 0 && " (has content)"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CampaignFormDialog
        campaignId={editingCampaignId}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />

      {deletingCampaign && (
        <DeleteCampaignDialog
          campaignId={deletingCampaign.id}
          campaignName={deletingCampaign.name}
          contentCount={deletingCampaign.contentCount}
          onOpenChange={setDeleteDialogOpen}
          open={deleteDialogOpen}
        />
      )}
    </div>
  );
}
