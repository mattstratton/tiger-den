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

  return <>{children}</>;
}
