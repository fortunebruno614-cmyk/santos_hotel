import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Unauthorized</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this area.
        </p>
        <Link href="/" className="underline">
          Go home
        </Link>
      </div>
    </main>
  );
}
