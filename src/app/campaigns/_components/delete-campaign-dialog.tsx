"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

interface DeleteCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  contentCount: number;
}

export function DeleteCampaignDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  contentCount,
}: DeleteCampaignDialogProps) {
  const utils = api.useUtils();

  const deleteMutation = api.campaigns.delete.useMutation({
    onSuccess: () => {
      void utils.campaigns.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to delete campaign:", error);
    },
  });

  const description =
    contentCount > 0
      ? `This campaign is assigned to ${contentCount} content item${contentCount > 1 ? "s" : ""}. You must reassign or remove the content before deleting this campaign.`
      : `Are you sure you want to delete "${campaignName}"? This action cannot be undone.`;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={contentCount > 0 || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: campaignId })}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
