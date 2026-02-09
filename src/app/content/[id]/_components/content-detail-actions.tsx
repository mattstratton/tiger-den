"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { ContentFormDialog } from "../../_components/content-form-dialog";
import { DeleteContentDialog } from "../../_components/delete-content-dialog";

interface ContentDetailActionsProps {
  contentId: string;
  title: string;
}

export function ContentDetailActions({
  contentId,
  title,
}: ContentDetailActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    router.push("/content");
  };

  return (
    <div className="flex gap-2">
      <Button
        aria-label="Edit content"
        onClick={() => setEditDialogOpen(true)}
        variant="outline"
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
      <Button
        aria-label="Delete content"
        onClick={() => setDeleteDialogOpen(true)}
        variant="destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>

      <ContentFormDialog
        contentId={contentId}
        onOpenChange={setEditDialogOpen}
        open={editDialogOpen}
      />

      <DeleteContentDialog
        contentId={contentId}
        contentTitle={title}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        open={deleteDialogOpen}
      />
    </div>
  );
}
