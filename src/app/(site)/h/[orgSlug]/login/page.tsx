import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { loginStaff } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { loadTenantMember } from "@/server/auth/tenancy";
import { getPublicOrganizationBySlug } from "@/server/public/organizations";

const MESSAGES: Record<string, string> = {
  invalid: "That e-mail and password do not match an active staff account.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  forbidden: "This account is not an active member of this hotel group.",
};

type TenantLoginProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: TenantLoginProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const organization = await getPublicOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Tenant sign in" };
  return {
    title: `Staff sign in · ${organization.name}`,
    description: `Sign in to the ${organization.name} operations console.`,
  };
}

/**
 * Tenant-branded sign-in door (`/h/[orgSlug]/login`).
 *
 * The slug selects the door and the branding only. The login action re-reads
 * the organization and the user's membership before issuing a session, so the
 * resulting `orgId` is always backed by an ACTIVE membership in this tenant.
 */
export default async function TenantLoginPage({ params, searchParams }: TenantLoginProps) {
  const [{ orgSlug }, sp] = await Promise.all([params, searchParams]);
  const organization = await getPublicOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const session = await getCurrentSession();
  if (session?.kind === "staff" && session.userId && session.orgId === organization.id) {
    const member = await loadTenantMember(session.userId, session.orgId);
    if (member) redirect("/admin");
  }

  const error = MESSAGES[sp.error ?? ""] ?? null;

  return (
    <div className="container page-content">
      <Breadcrumb current={`${organization.name} staff sign in`} />
      <div className="account-auth">
        <span className="auth-icon">
          <Building2 />
        </span>
        <PageHeading
          eyebrow={organization.name}
          title="Staff sign in"
          description={`Sign in to manage ${organization.name}'s properties, rooms, rates and reservations.`}
        />

        {error && <p className="form-error">{error}</p>}

        <form action={loginStaff}>
          <input type="hidden" name="portal" value="tenant" />
          <input type="hidden" name="orgSlug" value={organization.slug} />
          <input type="hidden" name="next" value="/admin" />
          <label>
            Staff email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@hotel.example"
            />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <Button className="w-full" type="submit">
            Sign in to {organization.name}
            <ArrowRight />
          </Button>
        </form>

        <p className="tiny-note">
          Looking for a room?{" "}
          <Link href={`/h/${organization.slug}`} className="underline">
            Back to {organization.name}
          </Link>
          .
        </p>

        <p className="tiny-note">
          Guest account?{" "}
          <Link href="/login" className="underline">
            Guest sign in
          </Link>
          . Santo platform operator?{" "}
          <Link href="/platform/login" className="underline">
            Platform sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
