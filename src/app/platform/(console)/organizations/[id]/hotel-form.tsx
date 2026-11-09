"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/maps/location-picker";
import { createHotelForOrganizationAction } from "@/server/platform/actions";

export function PlatformHotelForm({ organizationId }: { organizationId: string }) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  return (
    <form action={createHotelForOrganizationAction} className="space-y-3 rounded-md border p-4">
      <h2 className="font-medium">Add a property</h2>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Name</span>
          <input name="hotelName" required className="border px-2 py-1 rounded-md w-64" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Slug</span>
          <input
            name="hotelSlug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="border px-2 py-1 rounded-md w-64"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Phone</span>
          <input name="hotelPhone" className="border px-2 py-1 rounded-md w-44" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">E-mail</span>
          <input name="hotelEmail" type="email" className="border px-2 py-1 rounded-md w-60" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Timezone</span>
          <input name="timezone" defaultValue="Africa/Lagos" className="border px-2 py-1 rounded-md w-52" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Currency</span>
          <input name="currency" defaultValue="NGN" maxLength={3} className="border px-2 py-1 rounded-md w-24 uppercase" />
        </label>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Address line 1</span>
          <input name="addressLine1" className="border px-2 py-1 rounded-md w-64" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">City</span>
          <input name="city" className="border px-2 py-1 rounded-md w-44" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Country</span>
          <input name="country" className="border px-2 py-1 rounded-md w-44" />
        </label>
      </div>
      <LocationPicker
        latitude={latitude}
        longitude={longitude}
        onChange={(next) => {
          setLatitude(next.latitude);
          setLongitude(next.longitude);
        }}
      />
      <button className="border px-4 py-2 rounded-md text-sm font-medium" type="submit">
        Add property
      </button>
    </form>
  );
}
