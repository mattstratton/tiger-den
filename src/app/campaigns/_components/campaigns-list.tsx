"use client";

import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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

export function CampaignsList() {
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

  if (isLoading) {
    return <div className="py-8 text-center">Loading campaigns...</div>;
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={handleAddCampaign}>Add Campaign</Button>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          No campaigns found. Create your first campaign to get started.
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
                <TableCell>
                  {format(new Date(campaign.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label={`Edit ${campaign.name}`}
                      onClick={() => handleEditCampaign(campaign.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={`Delete ${campaign.name}`}
                      disabled={campaign.contentCount > 0}
                      onClick={() =>
                        handleDeleteCampaign(
                          campaign.id,
                          campaign.name,
                          campaign.contentCount,
                        )
                      }
                      size="icon"
                      title={
                        campaign.contentCount > 0
                          ? "Cannot delete campaign with assigned content"
                          : undefined
                      }
                      variant="ghost"
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
