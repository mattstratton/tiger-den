"use client";

import { api } from "~/trpc/react";
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
      console.error('Failed to delete campaign:', error);
    },
  });

  const description =
    contentCount > 0
      ? `This campaign is assigned to ${contentCount} content item${contentCount > 1 ? 's' : ''}. You must reassign or remove the content before deleting this campaign.`
      : `Are you sure you want to delete "${campaignName}"? This action cannot be undone.`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate({ id: campaignId })}
            disabled={contentCount > 0 || deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
