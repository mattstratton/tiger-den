"use client";

import { LayoutGrid, List, Plus, Trash2, Upload } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { api } from "~/trpc/react";
import { ContentFormDialog } from "./content-form-dialog";
import { ImportCsvDialog } from "./import-csv-dialog";

interface ContentToolbarProps {
  totalItems: number;
  viewMode: "grid" | "table";
  onViewModeChange: (mode: "grid" | "table") => void;
  isAdmin: boolean;
}

export function ContentToolbar({
  totalItems,
  viewMode,
  onViewModeChange,
  isAdmin,
}: ContentToolbarProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const utils = api.useUtils();

  const deleteAllMutation = api.content.deleteAll.useMutation({
    onSuccess: () => {
      void utils.content.list.invalidate();
      setShowDeleteAllDialog(false);
    },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {totalItems} {totalItems === 1 ? "item" : "items"}
          </span>
          <ToggleGroup
            onValueChange={(value) => {
              if (value) onViewModeChange(value as "grid" | "table");
            }}
            size="sm"
            type="single"
            value={viewMode}
          >
            <ToggleGroupItem aria-label="Grid view" value="grid">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Table view" value="table">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add Content
          </Button>
          <Button
            onClick={() => setShowImportDialog(true)}
            size="sm"
            variant="outline"
          >
            <Upload className="mr-1 h-4 w-4" />
            Import CSV
          </Button>
          {isAdmin && (
            <Button
              onClick={() => setShowDeleteAllDialog(true)}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete All
            </Button>
          )}
        </div>
      </div>

      <ContentFormDialog onOpenChange={setShowAddDialog} open={showAddDialog} />

      <ImportCsvDialog
        onOpenChange={setShowImportDialog}
        open={showImportDialog}
      />

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>all content items</strong> from the database.
              <br />
              <br />
              This is a testing feature. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAllMutation.mutate()}
            >
              Delete All Content
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
