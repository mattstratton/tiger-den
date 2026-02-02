"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { CampaignFormDialog } from "./campaign-form-dialog";
import { DeleteCampaignDialog } from "./delete-campaign-dialog";

export function CampaignsList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | undefined>();
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

  const handleDeleteCampaign = (campaignId: string, campaignName: string, contentCount: number) => {
    setDeletingCampaign({ id: campaignId, name: campaignName, contentCount });
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return <div className="py-8 text-center">Loading campaigns...</div>;
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={handleAddCampaign}>Add Campaign</Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No campaigns found. Create your first campaign to get started.
        </div>
        <CampaignFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          campaignId={editingCampaignId}
        />

        {deletingCampaign && (
          <DeleteCampaignDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            campaignId={deletingCampaign.id}
            campaignName={deletingCampaign.name}
            contentCount={deletingCampaign.contentCount}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddCampaign}>Add Campaign</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Content Items</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>{campaign.description || "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{campaign.contentCount}</Badge>
                </TableCell>
                <TableCell>{format(new Date(campaign.createdAt), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCampaign(campaign.id)}
                      aria-label={`Edit ${campaign.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCampaign(campaign.id, campaign.name, campaign.contentCount)}
                      disabled={campaign.contentCount > 0}
                      title={campaign.contentCount > 0 ? "Cannot delete campaign with assigned content" : undefined}
                      aria-label={`Delete ${campaign.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CampaignFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaignId={editingCampaignId}
      />

      {deletingCampaign && (
        <DeleteCampaignDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          campaignId={deletingCampaign.id}
          campaignName={deletingCampaign.name}
          contentCount={deletingCampaign.contentCount}
        />
      )}
    </div>
  );
}
