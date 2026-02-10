"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import { Badge } from "~/components/ui/badge";
import { PageHeader } from "~/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";

const roleColors = {
  admin:
    "bg-[var(--tiger-blood)]/10 text-[var(--tiger-blood)] border-[var(--tiger-blood)]/20",
  contributor:
    "bg-[var(--vivid-purple)]/10 text-[var(--vivid-purple)] border-[var(--vivid-purple)]/20",
  reader: "",
};

const roleLabels = {
  admin: "Admin",
  contributor: "Contributor",
  reader: "Reader",
};

export default function UsersPage() {
  const [roleChangePending, setRoleChangePending] = useState<{
    userId: string;
    newRole: "admin" | "contributor" | "reader";
  } | null>(null);

  const { data: users } = api.users.list.useQuery();
  const utils = api.useUtils();

  const updateRoleMutation = api.users.updateRole.useMutation({
    onSuccess: () => {
      void utils.users.list.invalidate();
      setRoleChangePending(null);
      toast.success("Role updated");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update role");
    },
  });

  const handleRoleChange = (
    userId: string,
    newRole: "admin" | "contributor" | "reader",
  ) => {
    setRoleChangePending({ userId, newRole });
  };

  const confirmRoleChange = () => {
    if (!roleChangePending) return;
    updateRoleMutation.mutate({
      userId: roleChangePending.userId,
      role: roleChangePending.newRole,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        description="Manage user roles and permissions"
        title="Users"
      />

      <div className="rounded-lg border">
        <Table aria-label="Users">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name || "\u2014"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <Select
                    disabled={updateRoleMutation.isPending}
                    onValueChange={(value) =>
                      handleRoleChange(
                        user.id,
                        value as "admin" | "contributor" | "reader",
                      )
                    }
                    value={user.role}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>
                        <Badge
                          className={roleColors[user.role]}
                          variant="outline"
                        >
                          {roleLabels[user.role]}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="contributor">Contributor</SelectItem>
                      <SelectItem value="reader">Reader</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "\u2014"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Role Permissions</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            <strong>Admin:</strong> Full access including user management,
            content types, and all content operations
          </p>
          <p>
            <strong>Contributor:</strong> Can create, edit, and delete content
            and campaigns
          </p>
          <p>
            <strong>Reader:</strong> View-only access to content and campaigns
          </p>
        </AlertDescription>
      </Alert>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setRoleChangePending(null);
        }}
        open={!!roleChangePending}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change user role?</AlertDialogTitle>
            <AlertDialogDescription>
              {roleChangePending &&
                `Are you sure you want to change this user's role to ${roleLabels[roleChangePending.newRole]}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
