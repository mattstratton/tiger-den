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

interface DeleteVoiceProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileDisplayName: string;
}

export function DeleteVoiceProfileDialog({
  open,
  onOpenChange,
  profileId,
  profileDisplayName,
}: DeleteVoiceProfileDialogProps) {
  const utils = api.useUtils();

  const deleteMutation = api.voiceProfiles.delete.useMutation({
    onSuccess: () => {
      void utils.voiceProfiles.list.invalidate();
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Voice Profile</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{profileDisplayName}&quot;?
            This will also delete all their writing samples. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: profileId })}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
