"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ContentTypeBadge } from "~/app/content/_components/content-badge";
import { api } from "~/trpc/react";
import { ContentTypeFormDialog } from "./_components/content-type-form-dialog";

export default function ContentTypesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [deletingType, setDeletingType] = useState<{
    id: number;
    name: string;
    usageCount: number;
  } | null>(null);

  const { data: contentTypes } = api.contentTypes.list.useQuery();
  const utils = api.useUtils();

  const deleteMutation = api.contentTypes.delete.useMutation({
    onSuccess: () => {
      void utils.contentTypes.list.invalidate();
      setDeletingType(null);
    },
    onError: (error) => {
      console.error("Failed to delete content type:", error);
    },
  });

  const reassignAndDeleteMutation =
    api.contentTypes.reassignAndDelete.useMutation({
      onSuccess: () => {
        void utils.contentTypes.list.invalidate();
        setDeletingType(null);
      },
      onError: (error) => {
        console.error("Failed to reassign and delete content type:", error);
      },
    });

  const handleDelete = async (type: {
    id: number;
    name: string;
    isSystem: boolean;
  }) => {
    if (type.isSystem) {
      alert("System content types cannot be deleted");
      return;
    }

    // Fetch usage count
    try {
      const { count } =
        await utils.contentTypes.getUsageCount.fetch({ id: type.id });
      setDeletingType({ id: type.id, name: type.name, usageCount: count });
    } catch (error) {
      console.error("Failed to fetch usage count:", error);
      alert("Failed to check usage count");
    }
  };

  const confirmDelete = () => {
    if (!deletingType) return;

    if (deletingType.usageCount > 0) {
      // Find the "Other" system type to reassign items to
      const otherType = contentTypes?.find((ct) => ct.isSystem);
      if (!otherType) {
        alert("Cannot find system content type for reassignment");
        return;
      }

      reassignAndDeleteMutation.mutate({
        id: deletingType.id,
        reassignToId: otherType.id,
      });
    } else {
      deleteMutation.mutate({ id: deletingType.id });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl">Content Types</h2>
          <p className="text-muted-foreground text-sm">
            Manage content type categories and their display settings
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Content Type
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Badge Preview</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contentTypes?.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-2 py-1 text-xs">
                    {type.slug}
                  </code>
                </TableCell>
                <TableCell>
                  <ContentTypeBadge type={type} />
                </TableCell>
                <TableCell>
                  {type.isSystem ? (
                    <span className="text-muted-foreground text-xs">System</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Custom</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setEditingTypeId(type.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={type.isSystem}
                      onClick={() => handleDelete(type)}
                      size="sm"
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

      <ContentTypeFormDialog
        onOpenChange={(open) => {
          if (!open) setShowAddDialog(false);
        }}
        open={showAddDialog}
      />

      {editingTypeId && (
        <ContentTypeFormDialog
          contentTypeId={editingTypeId}
          onOpenChange={(open) => {
            if (!open) setEditingTypeId(null);
          }}
          open={true}
        />
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeletingType(null);
        }}
        open={!!deletingType}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Type?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingType?.usageCount === 0 ? (
                <>
                  Are you sure you want to delete{" "}
                  <strong>{deletingType?.name}</strong>? This action cannot be
                  undone.
                </>
              ) : (
                <>
                  <strong>{deletingType?.name}</strong> is currently used by{" "}
                  <strong>{deletingType?.usageCount}</strong> content item(s).
                  <br />
                  <br />
                  Clicking &quot;Delete and Reassign&quot; will move all items
                  to the &quot;Other&quot; category and delete this content
                  type.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {deletingType?.usageCount === 0
                ? "Delete"
                : "Delete and Reassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
