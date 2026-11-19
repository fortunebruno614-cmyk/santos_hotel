"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
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
    <form action={verifyLocationAction} className="space-y-4">
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
      <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.06] pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Precision
          </span>
          <select name="precision" defaultValue="EXACT" className="w-60">
            <option value="EXACT">Exact building entrance</option>
            <option value="NEIGHBORHOOD">Neighborhood</option>
            <option value="APPROXIMATE">Approximate</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={!latitude || !longitude}
          className="p-btn p-btn-primary"
        >
          <MapPin className="size-3.5" />
          Save verified position
        </button>
      </div>
    </form>
  );
}
