import Link from "next/link";
import { logout } from "@/server/auth/actions";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const { reason } = await searchParams;
  const noProperty = reason === "no-property";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">
          {noProperty ? "No property assigned" : "Unauthorized"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {noProperty
            ? "Your account is active, but it is not linked to a hotel yet. Ask an organization owner to assign you to a property, then sign in again."
            : "You do not have permission to access this area."}
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link href="/" className="underline">
            Go home
          </Link>
          <form action={logout}>
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
