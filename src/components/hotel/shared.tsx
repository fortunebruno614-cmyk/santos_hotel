"use client";

import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Maximize,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/components/hotel/locale-provider";
import { formatMoney, nightsBetween, type ListingRoom, type StayQuery } from "@/lib/hotel";

export function Breadcrumb({ current }: { current: string }) {
  const t = useT();
  return (
    <div className="breadcrumb">
      <Link href="/">{t("breadcrumb.home")}</Link>
      <ChevronRight size={12} />
      <span>{current}</span>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}

function priceText(room: ListingRoom) {
  return room.price ? room.price.nightlyRate : room.basePrice;
}

export function RoomCard({
  room,
  stay,
  currency,
  displayCurrency,
  horizontal = false,
  href,
  bookHref,
  policyNote,
  selected = false,
  onSelect,
}: {
  room: ListingRoom;
  stay?: StayQuery;
  currency: string;
  displayCurrency?: string;
  horizontal?: boolean;
  href: string;
  bookHref?: string;
  policyNote?: string;
  /** Highlighted by the listing's map view; purely visual selection, no booking effect. */
  selected?: boolean;
  onSelect?: () => void;
}) {
  const t = useT();
  const nights = stay ? nightsBetween(stay.checkIn, stay.checkOut) : 0;
  const nightly = priceText(room);
  const stayTotal = room.price?.stayTotal;

  return (
    <article
      className={`room-card ${horizontal ? "horizontal" : ""}${selected ? " is-selected" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <Link href={href} className="room-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={room.images[0]} alt={room.name} width={1536} height={1024} loading="lazy" />
        <span className="photo-tag">
          {room.isSuite ? t("room.suiteCollection") : t("room.guestFavourite")}
        </span>
        <span className="photo-arrow">
          <ArrowRight size={18} />
        </span>
      </Link>
      <div className="room-card-body">
        <div className="room-card-main">
          <span className="room-category">
            {room.isSuite ? t("room.categorySuite") : t("room.categoryRetreat")}
          </span>
          <h3>
            <Link href={href}>{room.name}</Link>
          </h3>
          <p>{room.description || t("room.descriptionFallback")}</p>
          <div className="room-specs">
            <span>
              <UsersRound /> {t("room.guests", { count: room.maxAdults })}
            </span>
            <span>
              <BedDouble /> {room.bed}
            </span>
            <span>
              <Maximize /> {t("room.ensuite")}
            </span>
          </div>
          {horizontal && (
            <>
              <div className="room-specs">
                {room.amenities.slice(0, 2).map((amenity) => (
                  <span key={amenity}>
                    <Check /> {amenity}
                  </span>
                ))}
                {room.availableCount !== undefined && (
                  <span>
                    <Check /> {t("room.availableCount", { count: room.availableCount })}
                  </span>
                )}
              </div>
              {policyNote && (
                <p className="policy-note">
                  <Check size={14} /> {policyNote}
                </p>
              )}
            </>
          )}
        </div>
        <div className="room-card-bottom">
          <div>
            <span className="rate-from">{t("room.from")} </span>
            <strong>{formatMoney(nightly, currency, displayCurrency)}</strong>
            <span className="rate-unit"> {t("room.perNight")}</span>
            {horizontal && stay && stayTotal && (
              <small>
                {t("room.stayTotal", {
                  total: formatMoney(stayTotal, currency, displayCurrency),
                  nights,
                  unit: nights === 1 ? t("room.night") : t("room.nights"),
                })}
              </small>
            )}
          </div>
          <div className="room-card-links">
            {onSelect && (
              <button
                type="button"
                className="room-select"
                aria-pressed={selected}
                onClick={onSelect}
              >
                {selected ? t("room.selected") : t("room.select")}
              </button>
            )}
            <Link href={href} className="text-link">
              {horizontal ? t("room.viewDetails") : t("room.viewRoom")}
              <ArrowRight size={15} />
            </Link>
            {bookHref && (
              <Button asChild className="room-book">
                <Link href={bookHref}>{t("room.book")}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Gallery({
  images,
  open,
  setOpen,
  title,
}: {
  images: string[];
  open: number | null;
  setOpen: (value: number | null) => void;
  title?: string;
}) {
  const t = useT();
  return (
    <Dialog
      open={open !== null}
      onOpenChange={(value) => {
        if (!value) setOpen(null);
      }}
    >
      <DialogContent className="gallery-dialog">
        <DialogTitle>{title ?? t("gallery.title")}</DialogTitle>
        <DialogDescription>
          {t("gallery.count", {
            current: open === null ? 1 : open + 1,
            total: images.length,
          })}
        </DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[open ?? 0]} alt={t("gallery.alt")} />
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setOpen(((open ?? 0) - 1 + images.length) % images.length)}
          >
            <ChevronLeft />
            {t("gallery.previous")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(((open ?? 0) + 1) % images.length)}
          >
            {t("gallery.next")}
            <ChevronRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GalleryTile({
  image,
  label,
  onClick,
}: {
  image: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button className="gallery-tile" variant="ghost" onClick={onClick} aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={label} width={1536} height={1024} loading="lazy" />
    </Button>
  );
}

export function ViewAllPhotos({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <Button className="all-photos" variant="secondary" onClick={onClick}>
      <Grid2X2 />
      {t("gallery.viewAll")}
    </Button>
  );
}
