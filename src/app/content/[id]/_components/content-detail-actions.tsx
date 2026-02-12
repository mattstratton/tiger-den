"use client";

import { FileText, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { ContentFormDialog } from "../../_components/content-form-dialog";
import { DeleteContentDialog } from "../../_components/delete-content-dialog";
import { LinkedInConverterModal } from "./linkedin-converter-modal";

interface ContentDetailActionsProps {
  contentId: string;
  title: string;
  currentUrl: string;
  description: string | null;
  tags: string[] | null;
}

export function ContentDetailActions({
  contentId,
  title,
  currentUrl,
  description,
  tags,
}: ContentDetailActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkedInOpen, setLinkedInOpen] = useState(false);
  const router = useRouter();

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    router.push("/content");
  };

  return (
    <div className="flex gap-2">
      <Button
        aria-label="Copy for LinkedIn"
        onClick={() => setLinkedInOpen(true)}
        variant="outline"
      >
        <FileText className="mr-2 h-4 w-4" />
        Copy for LinkedIn
      </Button>
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

      <LinkedInConverterModal
        contentDescription={description}
        contentId={contentId}
        contentTags={tags}
        contentTitle={title}
        contentUrl={currentUrl}
        onOpenChange={setLinkedInOpen}
        open={linkedInOpen}
      />

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
