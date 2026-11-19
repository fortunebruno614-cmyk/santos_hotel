import { PageHeader } from "@/components/platform/ui";
import { OrganizationCreateForm } from "./organization-form";

const MESSAGES: Record<string, string> = {
  conflict: "That slug or owner e-mail is already in use.",
  invalid_body: "Please check the organization, owner and hotel fields.",
  internal: "The organization could not be created.",
};

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title="Onboard a hotel business"
        description="Creates the tenant organization, its owner account and (optionally) the first property with its business address and map position."
      />
      <OrganizationCreateForm error={MESSAGES[sp.error ?? ""] ?? null} />
    </div>
  );
}
