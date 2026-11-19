import { prisma } from "@/lib/prisma";
import { PlatformShell, type PlatformSearchItem } from "@/components/platform/shell";
import { requirePlatformPage } from "@/server/auth/tenancy";
import "../platform.css";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { session, platformRole } = await requirePlatformPage();

  const [user, pendingVerification, pendingReviews, organizations, properties] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId! },
        select: { name: true, email: true },
      }),
      prisma.organizationKyc.count({ where: { status: "PENDING" } }),
      prisma.hotel.count({
        where: { publicationStatus: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
      prisma.organization.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
      prisma.hotel.findMany({
        orderBy: { name: "asc" },
        take: 120,
        select: {
          id: true,
          name: true,
          slug: true,
          publicationStatus: true,
          organization: { select: { name: true } },
        },
      }),
    ]);

  const operator = {
    name: user?.name ?? session.email ?? "Platform operator",
    email: user?.email ?? session.email ?? "",
    role: platformRole,
  };

  const searchItems: PlatformSearchItem[] = [
    { href: "/platform", label: "Overview", hint: "Platform dashboard", group: "Navigate" },
    {
      href: "/platform/organizations",
      label: "Organizations",
      hint: "All hotel businesses",
      group: "Navigate",
    },
    {
      href: "/platform/properties",
      label: "Properties",
      hint: "Marketplace listings",
      group: "Navigate",
    },
    {
      href: "/platform/verification",
      label: "Verification queue",
      hint: "Business KYC reviews",
      group: "Navigate",
    },
    {
      href: "/platform/organizations/new",
      label: "Onboard business",
      hint: "Create an organization and owner",
      group: "Navigate",
    },
    {
      href: "/platform/analytics",
      label: "Analytics",
      hint: "Marketplace growth and revenue",
      group: "Navigate",
    },
    {
      href: "/platform/activity",
      label: "Activity",
      hint: "Platform audit trail",
      group: "Navigate",
    },
    {
      href: "/platform/operators",
      label: "Operators",
      hint: "Platform team",
      group: "Navigate",
    },
    ...organizations.map((organization) => ({
      href: `/platform/organizations/${organization.id}`,
      label: organization.name,
      hint: organization.slug,
      group: "Organizations" as const,
    })),
    ...properties.map((property) => ({
      href: `/platform/hotels/${property.id}`,
      label: property.name,
      hint: `${property.organization.name} · ${property.publicationStatus.toLowerCase()}`,
      group: "Properties" as const,
    })),
  ];

  return (
    <PlatformShell
      operator={operator}
      pendingVerification={pendingVerification}
      pendingReviews={pendingReviews}
      organizations={organizations}
      searchItems={searchItems}
    >
      {children}
    </PlatformShell>
  );
}
