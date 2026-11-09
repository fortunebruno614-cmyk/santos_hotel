"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/maps/location-picker";
import { createOrganizationAction } from "@/server/platform/actions";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function OrganizationCreateForm({ error }: { error: string | null }) {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [hotelName, setHotelName] = useState("");
  const [hotelSlug, setHotelSlug] = useState("");
  const [hotelSlugTouched, setHotelSlugTouched] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  return (
    <form action={createOrganizationAction} className="max-w-4xl space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-medium">Hotel business (organization)</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Business name</span>
            <input
              name="organizationName"
              required
              value={orgName}
              onChange={(event) => {
                setOrgName(event.target.value);
                if (!slugTouched) setOrgSlug(slugify(event.target.value));
              }}
              className="border px-2 py-1 rounded-md w-72"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Organization slug</span>
            <input
              name="organizationSlug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={orgSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setOrgSlug(slugify(event.target.value));
              }}
              className="border px-2 py-1 rounded-md w-72"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Business e-mail</span>
            <input name="organizationEmail" type="email" className="border px-2 py-1 rounded-md w-64" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Business phone</span>
            <input name="organizationPhone" className="border px-2 py-1 rounded-md w-48" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Country</span>
            <input name="organizationCountry" className="border px-2 py-1 rounded-md w-48" />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-medium">Owner account (tenant administrator)</h2>
        <p className="text-xs text-zinc-500">
          This user signs in at <code>/staff/login</code> and manages this organization&apos;s
          properties.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Owner name</span>
            <input name="ownerName" required className="border px-2 py-1 rounded-md w-64" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Owner e-mail</span>
            <input
              name="ownerEmail"
              type="email"
              required
              className="border px-2 py-1 rounded-md w-64"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Temporary password</span>
            <input
              name="ownerPassword"
              type="password"
              minLength={8}
              required
              className="border px-2 py-1 rounded-md w-56"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-medium">First property</h2>
        <p className="text-xs text-zinc-500">
          Every organization needs at least one property before the tenant console is usable.
        </p>
        <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Property name</span>
                <input
                  name="hotelName"
                  required
                  value={hotelName}
                  onChange={(event) => {
                    setHotelName(event.target.value);
                    if (!hotelSlugTouched) setHotelSlug(slugify(event.target.value));
                  }}
                  className="border px-2 py-1 rounded-md w-72"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Public slug</span>
                <input
                  name="hotelSlug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={hotelSlug}
                  onChange={(event) => {
                    setHotelSlugTouched(true);
                    setHotelSlug(slugify(event.target.value));
                  }}
                  className="border px-2 py-1 rounded-md w-72"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Phone</span>
                <input name="hotelPhone" className="border px-2 py-1 rounded-md w-48" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">E-mail</span>
                <input name="hotelEmail" type="email" className="border px-2 py-1 rounded-md w-64" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Timezone</span>
                <input name="timezone" defaultValue="Africa/Lagos" className="border px-2 py-1 rounded-md w-56" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Currency</span>
                <input name="currency" defaultValue="NGN" maxLength={3} className="border px-2 py-1 rounded-md w-24 uppercase" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Address line 1</span>
                <input name="addressLine1" className="border px-2 py-1 rounded-md w-72" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Address line 2</span>
                <input name="addressLine2" className="border px-2 py-1 rounded-md w-72" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">City</span>
                <input name="city" className="border px-2 py-1 rounded-md w-48" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Postcode</span>
                <input name="postcode" className="border px-2 py-1 rounded-md w-28" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Country</span>
                <input name="country" className="border px-2 py-1 rounded-md w-48" />
              </label>
            </div>
            <input type="hidden" name="latitude" value={latitude} />
            <input type="hidden" name="longitude" value={longitude} />
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(next) => {
                setLatitude(next.latitude);
                setLongitude(next.longitude);
              }}
            />
        </div>
      </section>

      <button className="border px-4 py-2 rounded-md text-sm font-medium" type="submit">
        Create organization
      </button>
    </form>
  );
}
