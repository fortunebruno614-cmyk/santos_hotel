"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, Field, Notice } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
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
    <form action={createTenantHotelAction} className="max-w-4xl space-y-5">
      {error && <Notice tone="danger">{error}</Notice>}

      <Card>
        <CardHeader
          title="Business information"
          description="The public name, contact details and selling currency for the new property."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Property name" required className="w-72">
              <input
                name="name"
                required
                minLength={2}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugTouched) setSlug(slugify(event.target.value));
                }}
              />
            </Field>
            <Field label="Public slug" required className="w-72">
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
              />
            </Field>
            <Field label="Phone" className="w-48">
              <input name="phone" />
            </Field>
            <Field label="E-mail" className="w-64">
              <input name="email" type="email" />
            </Field>
            <Field label="Timezone (IANA)" className="w-56">
              <input name="timezone" defaultValue="Africa/Lagos" />
            </Field>
            <Field label="Currency (ISO)" className="w-28">
              <input name="currency" defaultValue="NGN" maxLength={3} className="uppercase" />
            </Field>
          </div>
          <Field label="Description">
            <textarea name="description" rows={3} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Address & map location"
          description="Coordinates are optional, but the public map only renders once a platform operator verifies them."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Address line 1" className="w-72">
              <input name="addressLine1" />
            </Field>
            <Field label="Address line 2" className="w-72">
              <input name="addressLine2" />
            </Field>
            <Field label="City" className="w-48">
              <input name="city" />
            </Field>
            <Field label="Postcode" className="w-28">
              <input name="postcode" />
            </Field>
            <Field label="Country" className="w-48">
              <input name="country" />
            </Field>
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
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Create property</Button>
        <p className="text-xs text-muted-foreground">
          The new property starts as a draft. Add room types and rooms, then submit it for
          publication from the hotels screen.
        </p>
      </div>
    </form>
  );
}
