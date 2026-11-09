import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setupPlatformAction } from "@/server/platform/actions";
import { countPlatformAdmins } from "@/server/platform/admins";

const MESSAGES: Record<string, string> = {
  invalid_body: "Please check the form values (password must be at least 8 characters).",
  conflict: "Platform operators already exist. Please sign in instead.",
};

/** One-time bootstrap; disabled the moment a platform operator exists. */
export default async function PlatformSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  if ((await countPlatformAdmins()) > 0) redirect("/platform/login");
  const error = MESSAGES[sp.error ?? ""] ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-zinc-900 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Santo Platform
            </p>
            <h1 className="text-xl font-semibold">Create the first platform admin</h1>
          </div>
        </div>

        <p className="mb-4 text-sm text-zinc-600">
          This page is available only while the platform has no operators. It creates the
          Santo marketplace administrator who can onboard hotel organizations and publish
          listings.
        </p>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={setupPlatformAction} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Your name</span>
            <input
              name="name"
              required
              autoComplete="name"
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Operator email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Password</span>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <Button className="w-full" type="submit">
            Create platform administrator
          </Button>
        </form>

        <p className="mt-6 border-t pt-4 text-xs text-zinc-500">
          Already set up?{" "}
          <Link href="/platform/login" className="underline">
            Operator sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
