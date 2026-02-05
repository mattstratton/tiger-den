"use client";

import { Badge } from "~/components/ui/badge";
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
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  contributor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  reader: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const roleLabels = {
  admin: "Admin",
  contributor: "Contributor",
  reader: "Reader",
};

export default function UsersPage() {
  const { data: users } = api.users.list.useQuery();
  const { data: myRole } = api.users.getMyRole.useQuery();
  const utils = api.useUtils();

  const updateRoleMutation = api.users.updateRole.useMutation({
    onSuccess: () => {
      void utils.users.list.invalidate();
    },
    onError: (error) => {
      alert(error.message || "Failed to update role");
    },
  });

  const handleRoleChange = (
    userId: string,
    newRole: "admin" | "contributor" | "reader",
  ) => {
    if (
      !confirm(
        `Are you sure you want to change this user's role to ${roleLabels[newRole]}?`,
      )
    ) {
      return;
    }

    updateRoleMutation.mutate({ userId, role: newRole });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-semibold text-2xl">User Management</h2>
        <p className="text-muted-foreground text-sm">
          Manage user roles and permissions
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name || "—"}
                </TableCell>
                <TableCell>{user.email}</TableCell>
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
                        <Badge className={roleColors[user.role]}>
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
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 rounded-lg border border-muted bg-muted/50 p-4">
        <h3 className="mb-2 font-medium text-sm">Role Permissions</h3>
        <div className="space-y-2 text-muted-foreground text-sm">
          <div>
            <strong className="text-foreground">Admin:</strong> Full access
            including user management, content types, and all content operations
          </div>
          <div>
            <strong className="text-foreground">Contributor:</strong> Can
            create, edit, and delete content and campaigns
          </div>
          <div>
            <strong className="text-foreground">Reader:</strong> View-only
            access to content and campaigns
          </div>
        </div>
      </div>
    </div>
  );
}
