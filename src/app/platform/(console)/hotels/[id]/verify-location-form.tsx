"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/maps/location-picker";
import { verifyLocationAction } from "@/server/platform/actions";

export function VerifyLocationForm({
  hotelId,
  initialLatitude,
  initialLongitude,
}: {
  hotelId: string;
  initialLatitude: string;
  initialLongitude: string;
}) {
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);

  return (
    <form action={verifyLocationAction} className="space-y-3 rounded-md border p-4">
      <h2 className="font-medium">Verified map location</h2>
      <input type="hidden" name="hotelId" value={hotelId} />
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
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">Precision</span>
        <select name="precision" defaultValue="EXACT" className="border px-2 py-1 rounded-md">
          <option value="EXACT">Exact building entrance</option>
          <option value="NEIGHBORHOOD">Neighborhood</option>
          <option value="APPROXIMATE">Approximate</option>
        </select>
        <button
          type="submit"
          disabled={!latitude || !longitude}
          className="border px-3 py-1 rounded-md disabled:opacity-50"
        >
          Save verified position
        </button>
      </label>
    </form>
  );
}
