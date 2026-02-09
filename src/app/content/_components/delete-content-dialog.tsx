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
import { Alert, AlertDescription } from "~/components/ui/alert";
import { api } from "~/trpc/react";

interface DeleteContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  onSuccess?: () => void;
}

export function DeleteContentDialog({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  onSuccess,
}: DeleteContentDialogProps) {
  const utils = api.useUtils();

  const deleteMutation = api.content.delete.useMutation({
    onSuccess: () => {
      void utils.content.list.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Failed to delete content:", error);
      // Dialog stays open so user can see the error and retry
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: contentId });
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &quot;{contentTitle}&quot;. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteMutation.error.message}
            </AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
            variant="destructive"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
