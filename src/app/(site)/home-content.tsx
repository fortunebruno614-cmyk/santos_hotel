"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Coffee,
  HeartHandshake,
  Leaf,
  MapPin,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Gallery, GalleryTile, RoomCard } from "@/components/hotel/shared";
import { SearchPanel } from "@/components/hotel/search-panel";
import { useDisplayCurrency } from "@/components/hotel/currency-provider";
import { useT } from "@/components/hotel/locale-provider";
import type { Dictionary } from "@/lib/dictionaries";
import {
  GALLERY_IMAGES,
  defaultStayDates,
  formatMoney,
  searchHref,
  type InventoryRoom,
  type ListingRoom,
} from "@/lib/hotel";

/** Offer and highlight copy is keyed, not literal — it is translated at render.
 *  These are *prefixes* (`home.offer.slow` → `.name` / `.eyebrow` / `.desc`),
 *  so the suffix is appended and asserted at the call site. */
const OFFERS = [
  { key: "home.offer.slow", img: "/images/santo-pool.jpg" },
  { key: "home.offer.longer", img: "/images/santo-suite.jpg" },
] as const;

const HIGHLIGHTS = [
  [Leaf, "home.highlight.design"],
  [HeartHandshake, "home.highlight.welcome"],
  [Coffee, "home.highlight.slow"],
  [Sparkles, "home.highlight.comfort"],
] as const;

export function HomeContent({
  rooms,
  inventory,
  currency,
  heroTitle,
  heroBody,
  address,
  hotelName,
}: {
  rooms: ListingRoom[];
  inventory: InventoryRoom[];
  currency: string;
  heroTitle: string;
  heroBody: string;
  address: string;
  hotelName: string;
}) {
  const [gallery, setGallery] = useState<number | null>(null);
  const display = useDisplayCurrency();
  const t = useT();
  const dates = defaultStayDates();
  const stay = { ...dates, adults: 2, children: 0, quantity: 1 };
  const bookHref = searchHref(stay);

  const [firstLine, ...rest] = heroTitle.split(",");
  const secondLine = rest.join(",").trim();

  return (
    <>
      <section className="home-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-image"
          src="/images/santo-lobby.jpg"
          alt={t("home.hero.alt")}
          width={1920}
          height={1024}
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="hero-eyebrow">
            <span /> {t("home.hero.eyebrow", { hotel: hotelName.toUpperCase() })}
          </span>
          <h1>
            {firstLine},
            {secondLine && (
              <>
                <br />
                <em>{secondLine}</em>
              </>
            )}
          </h1>
          <p>{heroBody}</p>
          <div className="hero-ctas">
            <Button asChild variant="outline" className="hero-explore">
              <Link href="/rooms">
                {t("home.hero.explore")} <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild className="hero-book">
              <Link href={bookHref}>
                {t("header.book")} <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="hero-bottom">
            <span>{t("home.hero.tagline")}</span>
            <span className="hero-slide">
              <b>01</b>
              <i />
              03
            </span>
          </div>
        </div>
      </section>

      <div className="container home-search">
        <SearchPanel defaults={stay} />
        <div className="search-reassurance">
          <span>
            <span className="small-check">✓</span> {t("home.reassurance.yourWay")}
          </span>
          <span>
            <span className="small-check">✓</span> {t("home.reassurance.clearPrices")}
          </span>
          <span>
            <span className="small-check">✓</span> {t("home.reassurance.welcome")}
          </span>
          <small>{t("home.reassurance.live")}</small>
        </div>
      </div>

      <section className="container section featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("home.rooms.eyebrow")}</span>
            <h2>{t("home.rooms.title")}</h2>
          </div>
          <Link href="/rooms" className="text-link">
            {t("home.rooms.explore")} <ArrowRight size={17} />
          </Link>
        </div>
        <p className="section-intro">{t("home.rooms.intro")}</p>
        <div className="room-grid">
          {rooms.slice(0, 3).map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              currency={currency}
              displayCurrency={display}
              href={`/rooms/${room.slug}`}
              bookHref={searchHref(stay, `/rooms/${room.slug}`)}
            />
          ))}
        </div>
      </section>

      <section className="container section inventory-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("home.inventory.eyebrow")}</span>
            <h2>{t("home.inventory.title", { count: inventory.length })}</h2>
          </div>
          <Link href="/rooms" className="text-link">
            {t("home.inventory.browse")} <ArrowRight size={17} />
          </Link>
        </div>
        <p className="section-intro">{t("home.inventory.intro")}</p>
        <div className="inventory-grid">
          {inventory.map((room) => (
            <article className="inventory-card" key={room.id}>
              <div className="inventory-meta">
                <span className="inventory-number">
                  {t("home.inventory.room", { number: room.roomNumber })}
                </span>
                <span className="inventory-floor">
                  {t("home.inventory.floor", { floor: room.floor ?? 1 })}
                </span>
              </div>
              <h3>
                <Link href={`/rooms/${room.typeSlug}`}>{room.typeName}</Link>
              </h3>
              <span className="inventory-kind">
                {room.isSuite ? t("room.suiteCollection") : t("room.guestFavourite")}
              </span>
              <div className="inventory-bottom">
                <div>
                  <strong>{formatMoney(room.basePrice, currency, display)}</strong>
                  <span className="rate-unit"> {t("room.perNight")}</span>
                </div>
                <Button asChild size="sm" className="room-book">
                  <Link href={searchHref(stay, `/rooms/${room.typeSlug}`)}>
                    {t("room.book")}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="why-section">
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">{t("home.why.eyebrow")}</span>
            <h2>{t("home.why.title")}</h2>
            <p>{t("home.why.intro")}</p>
          </div>
          <div className="highlights">
            {HIGHLIGHTS.map(([Icon, key]) => (
              <div key={key}>
                <Icon />
                <h3>{t(`${key}.title` as keyof Dictionary)}</h3>
                <p>{t(`${key}.copy` as keyof Dictionary)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("home.offers.eyebrow")}</span>
            <h2>{t("home.offers.title")}</h2>
          </div>
          <Link href="/offers" className="text-link">
            {t("home.offers.discover")} <ArrowRight size={17} />
          </Link>
        </div>
        <div className="home-offers">
          {OFFERS.map((offer, index) => (
            <Link href="/offers" key={offer.key} className="offer-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={offer.img}
                alt={t(`${offer.key}.name` as keyof Dictionary)}
                loading="lazy"
                width={1536}
                height={1024}
              />
              <div>
                <span className="eyebrow">{t(`${offer.key}.eyebrow` as keyof Dictionary)}</span>
                <h3>{t(`${offer.key}.name` as keyof Dictionary)}</h3>
                <p>{t(`${offer.key}.desc` as keyof Dictionary)}</p>
                <span className="text-link">
                  {t("home.offers.explore")} <ArrowUpRight size={17} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="gallery-band">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("home.gallery.eyebrow")}</span>
              <h2>{t("home.gallery.title")}</h2>
            </div>
            <Button variant="ghost" onClick={() => setGallery(0)}>
              {t("home.gallery.view")} <ArrowUpRight />
            </Button>
          </div>
          <div className="home-gallery">
            {GALLERY_IMAGES.map((src, index) => (
              <GalleryTile
                key={src}
                image={src}
                label={t(
                  (["home.gallery.space1", "home.gallery.space2", "home.gallery.space3"] as const)[
                    index
                  ],
                )}
                onClick={() => setGallery(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="container section review-section">
        <div>
          <span className="eyebrow">{t("home.review.eyebrow")}</span>
          <h2>
            {t("home.review.titleLine1")}
            <br />
            {t("home.review.titleLine2")}
          </h2>
        </div>
        <div className="review-quote">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star key={value} size={15} />
            ))}
          </div>
          <blockquote>{t("home.review.quote")}</blockquote>
          <div className="review-author">
            <span>JT</span>
            <div>
              Jamie T.<small>{t("home.review.stayType")}</small>
            </div>
            <span className="sample-rating">
              9.4<small>{t("home.review.rating")}</small>
            </span>
          </div>
        </div>
      </section>

      <section className="location-band">
        <div className="container location-grid">
          <div>
            <span className="eyebrow">{t("home.location.eyebrow")}</span>
            <h2>
              {t("home.location.titleLine1")}
              <br />
              {t("home.location.titleLine2")}
            </h2>
            <p>{t("home.location.intro")}</p>
            <p className="address-placeholder">
              <MapPin size={17} />
              {address}
            </p>
            <Button asChild>
              <Link href="/contact">
                {t("home.location.cta")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="static-map">
            <div className="map-road r1" />
            <div className="map-road r2" />
            <div className="map-road r3" />
            <span className="map-pin">
              <MapPin />
              {hotelName.toUpperCase()}
            </span>
            <small>{t("home.location.mapNote")}</small>
          </div>
        </div>
      </section>

      <Gallery images={[...GALLERY_IMAGES]} open={gallery} setOpen={setGallery} />
    </>
  );
}
