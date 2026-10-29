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
import { formatMoney, nightsBetween, type ListingRoom, type StayQuery } from "@/lib/hotel";

export function Breadcrumb({ current }: { current: string }) {
  return (
    <div className="breadcrumb">
      <Link href="/">Home</Link>
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
        <span className="photo-tag">{room.isSuite ? "The suite collection" : "A guest favourite"}</span>
        <span className="photo-arrow">
          <ArrowRight size={18} />
        </span>
      </Link>
      <div className="room-card-body">
        <div className="room-card-main">
          <span className="room-category">
            {room.isSuite ? "THE SUITE COLLECTION" : "YOUR PERSONAL RETREAT"}
          </span>
          <h3>
            <Link href={href}>{room.name}</Link>
          </h3>
          <p>{room.description || "A thoughtfully considered space to unwind and feel at home."}</p>
          <div className="room-specs">
            <span>
              <UsersRound /> {room.maxAdults} guests
            </span>
            <span>
              <BedDouble /> {room.bed}
            </span>
            <span>
              <Maximize /> En-suite
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
                    <Check /> {room.availableCount} available
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
            <span className="rate-from">From </span>
            <strong>{formatMoney(nightly, currency, displayCurrency)}</strong>
            <span className="rate-unit"> / night</span>
            {horizontal && stay && stayTotal && (
              <small>
                {formatMoney(stayTotal, currency, displayCurrency)} for {nights}{" "}
                {nights === 1 ? "night" : "nights"} · before taxes &amp; fees
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
                {selected ? "Selected ✓" : "Select room"}
              </button>
            )}
            <Link href={href} className="text-link">
              {horizontal ? "View details" : "View room"}
              <ArrowRight size={15} />
            </Link>
            {bookHref && (
              <Button asChild className="room-book">
                <Link href={bookHref}>Book a room</Link>
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
  title = "A closer look at Santo",
}: {
  images: string[];
  open: number | null;
  setOpen: (value: number | null) => void;
  title?: string;
}) {
  return (
    <Dialog
      open={open !== null}
      onOpenChange={(value) => {
        if (!value) setOpen(null);
      }}
    >
      <DialogContent className="gallery-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Hotel photography · {open === null ? 1 : open + 1} of {images.length}
        </DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[open ?? 0]} alt="Santo Hotel gallery" />
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setOpen(((open ?? 0) - 1 + images.length) % images.length)}
          >
            <ChevronLeft />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(((open ?? 0) + 1) % images.length)}
          >
            Next
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
  return (
    <Button className="all-photos" variant="secondary" onClick={onClick}>
      <Grid2X2 />
      View all photos
    </Button>
  );
}
