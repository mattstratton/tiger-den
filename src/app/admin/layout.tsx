import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { AdminNav } from "./_components/admin-nav";

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
        <AdminNav />
      </div>

      {children}
    </div>
  );
}
