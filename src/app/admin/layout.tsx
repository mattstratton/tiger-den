import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect non-admin users
  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 font-bold text-3xl">Administration</h1>

      {/* Admin sub-navigation */}
      <div className="mb-6 border-b">
        <nav className="flex gap-6">
          <Link
            className="border-b-2 border-transparent pb-2 hover:border-gray-300"
            href="/admin/content-types"
          >
            Content Types
          </Link>
          <Link
            className="border-b-2 border-transparent pb-2 hover:border-gray-300"
            href="/admin/users"
          >
            Users
          </Link>
          <Link
            className="border-b-2 border-transparent pb-2 hover:border-gray-300"
            href="/admin/queue"
          >
            Queue
          </Link>
          <Link
            className="border-b-2 border-transparent pb-2 hover:border-gray-300"
            href="/admin/api-import"
          >
            API Import
          </Link>
        </nav>
      </div>

      {children}
    </div>
  );
}
