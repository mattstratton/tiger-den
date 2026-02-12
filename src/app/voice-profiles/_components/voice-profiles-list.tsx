"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EmptyState } from "~/components/ui/empty-state";
import { Loading } from "~/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { VoiceProfileFormDialog } from "./voice-profile-form-dialog";
import { DeleteVoiceProfileDialog } from "./delete-voice-profile-dialog";

export function VoiceProfilesList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const { data: profiles, isLoading } = api.voiceProfiles.list.useQuery();

  const handleAdd = () => {
    setDialogOpen(true);
  };

  const handleDelete = (id: string, displayName: string) => {
    setDeletingProfile({ id, displayName });
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return <Loading message="Loading voice profiles" />;
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          action={{ label: "Add Voice Profile", onClick: handleAdd }}
          message="No voice profiles yet. Create your first voice profile to get started."
        />
        <VoiceProfileFormDialog
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {profiles.length}{" "}
          {profiles.length === 1 ? "profile" : "profiles"}
        </span>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Voice Profile
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table aria-label="Voice Profiles">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Topics</TableHead>
              <TableHead>Samples</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow className="group" key={profile.id}>
                <TableCell className="font-medium">
                  <Link
                    className="hover:underline"
                    href={`/voice-profiles/${profile.id}`}
                  >
                    {profile.displayName}
                  </Link>
                  <span className="ml-2 text-muted-foreground text-xs">
                    @{profile.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.title || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {profile.topics?.slice(0, 3).map((topic) => (
                      <Badge key={topic} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                    {(profile.topics?.length ?? 0) > 3 && (
                      <Badge variant="outline">
                        +{(profile.topics?.length ?? 0) - 3}
                      </Badge>
                    )}
                    {!profile.topics?.length && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      profile.sampleCount > 0
                        ? "bg-[var(--pure-teal)]/10 text-[var(--pure-teal)]"
                        : ""
                    }
                    variant="secondary"
                  >
                    {profile.sampleCount}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Actions for ${profile.displayName}`}
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/voice-profiles/${profile.id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          handleDelete(profile.id, profile.displayName)
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <VoiceProfileFormDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />

      {deletingProfile && (
        <DeleteVoiceProfileDialog
          profileDisplayName={deletingProfile.displayName}
          profileId={deletingProfile.id}
          onOpenChange={setDeleteDialogOpen}
          open={deleteDialogOpen}
        />
      )}
    </div>
  );
}
