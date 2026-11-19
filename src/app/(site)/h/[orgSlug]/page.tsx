import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, LogIn, Mail, MapPin, Phone } from "lucide-react";
import { PageHeading } from "@/components/hotel/shared";
import {
  getPublicOrganizationBySlug,
  listOrganizationPublishedHotels,
} from "@/server/public/organizations";

type EntryPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: EntryPageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const organization = await getPublicOrganizationBySlug(orgSlug);
  if (!organization) return { title: "Hotel group not found" };
  return {
    title: `${organization.name} · Santo`,
    description: `Book stays from ${organization.name} through the Santo marketplace.`,
  };
}

/**
 * Tenant entry channel: one public landing page per hotel group.
 *
 * The organization is resolved by slug on the server and only ACTIVE tenants
 * are reachable. Its properties are filtered to PUBLISHED by the data layer,
 * so this page never becomes a side door to an unpublished listing.
 */
export default async function OrganizationEntryPage({ params }: EntryPageProps) {
  const { orgSlug } = await params;
  const organization = await getPublicOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const hotels = await listOrganizationPublishedHotels(organization.id);

  return (
    <div className="container page-content">
      <PageHeading
        eyebrow="SANTO TENANT CHANNEL"
        title={organization.name}
        description={`Book directly with the properties operated by ${organization.name}.`}
      />

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600">
          {organization.country && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} /> {organization.country}
            </span>
          )}
          {organization.email && (
            <a className="inline-flex items-center gap-1 hover:text-zinc-900" href={`mailto:${organization.email}`}>
              <Mail size={14} /> {organization.email}
            </a>
          )}
          {organization.phone && (
            <a className="inline-flex items-center gap-1 hover:text-zinc-900" href={`tel:${organization.phone}`}>
              <Phone size={14} /> {organization.phone}
            </a>
          )}
        </div>
        <Link
          href={`/h/${organization.slug}/login`}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          <LogIn size={14} />
          Staff sign in
        </Link>
      </div>

      {hotels.length === 0 ? (
        <div className="empty-state">
          <h2>No published properties yet.</h2>
          <p>This hotel group is preparing its listings. Please check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <Link
              key={hotel.id}
              href={`/hotels/${hotel.slug}`}
              className="group rounded-xl border p-5 transition hover:shadow-md"
            >
              <h2 className="text-lg font-semibold">{hotel.name}</h2>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-zinc-500">
                <MapPin size={14} />
                {[hotel.city, hotel.country].filter(Boolean).join(", ") || "Location to be confirmed"}
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-zinc-600">
                {hotel.description ?? "A Santo marketplace property."}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Prices in {hotel.currency}
                <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
