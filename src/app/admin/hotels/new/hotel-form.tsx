"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/maps/location-picker";
import { createTenantHotelAction } from "@/server/console/hotel-actions";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function HotelCreateForm({ error }: { error: string | null }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  return (
    <form action={createTenantHotelAction} className="max-w-3xl space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-medium">Business information</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Property name</span>
            <input
              name="name"
              required
              minLength={2}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              className="border px-2 py-1 rounded-md w-72"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Public slug</span>
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              className="border px-2 py-1 rounded-md w-72"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Phone</span>
            <input name="phone" className="border px-2 py-1 rounded-md w-48" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">E-mail</span>
            <input name="email" type="email" className="border px-2 py-1 rounded-md w-64" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Timezone (IANA)</span>
            <input
              name="timezone"
              defaultValue="Africa/Lagos"
              className="border px-2 py-1 rounded-md w-56"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Currency (ISO)</span>
            <input
              name="currency"
              defaultValue="NGN"
              maxLength={3}
              className="border px-2 py-1 rounded-md w-24 uppercase"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-zinc-500">Description</span>
          <textarea name="description" rows={3} className="border px-2 py-1 rounded-md" />
        </label>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-medium">Address &amp; map location</h2>
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
      </section>

      <button className="border px-4 py-2 rounded-md text-sm font-medium" type="submit">
        Create property
      </button>
      <p className="text-xs text-zinc-500">
        The new property starts as a draft. Add room types and rooms, then submit it for
        publication from the platform console.
      </p>
    </form>
  );
}
