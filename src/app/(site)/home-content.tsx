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
import {
  GALLERY_IMAGES,
  defaultStayDates,
  formatMoney,
  searchHref,
  type InventoryRoom,
  type ListingRoom,
} from "@/lib/hotel";

const OFFERS = [
  {
    name: "The Slow Weekend",
    eyebrow: "MAKE TIME FOR YOURSELF",
    description: "Trade your everyday rhythm for unhurried mornings and a well-deserved escape.",
  },
  {
    name: "Stay a Little Longer",
    eyebrow: "MORE TIME, MORE MEMORIES",
    description: "Settle in, explore at your own pace, and make yourself at home.",
  },
  {
    name: "Together at Santo",
    eyebrow: "MOMENTS WORTH SHARING",
    description: "A thoughtful setting for a special occasion or simply time together.",
  },
];

const HIGHLIGHTS = [
  [Leaf, "Thoughtfully designed", "Spaces that balance beautiful details with everyday comfort."],
  [HeartHandshake, "A genuine welcome", "A thoughtful approach to making you feel at home."],
  [Coffee, "Room to slow down", "Unhurried mornings and the simple pleasure of being here."],
  [Sparkles, "Comfort, considered", "The little touches that make all the difference."],
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
          alt="A welcoming Santo Hotel lobby with natural materials and garden views"
          width={1920}
          height={1024}
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="hero-eyebrow">
            <span /> A WARM WELCOME TO {hotelName.toUpperCase()}
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
                Find your kind of comfort <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild className="hero-book">
              <Link href={bookHref}>
                Book your stay <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="hero-bottom">
            <span>A considered stay. A genuine welcome.</span>
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
            <span className="small-check">✓</span> Your stay, your way
          </span>
          <span>
            <span className="small-check">✓</span> Clear prices, no surprises
          </span>
          <span>
            <span className="small-check">✓</span> A warm welcome awaits
          </span>
          <small>Live room availability · Secure booking</small>
        </div>
      </div>

      <section className="container section featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ROOMS & SUITES</span>
            <h2>A space to call your own.</h2>
          </div>
          <Link href="/rooms" className="text-link">
            Explore all rooms <ArrowRight size={17} />
          </Link>
        </div>
        <p className="section-intro">
          Unwind in thoughtfully designed spaces, where every detail feels just right.
        </p>
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
            <span className="eyebrow">THE ROOM LIST</span>
            <h2>All {inventory.length} rooms, ready to book.</h2>
          </div>
          <Link href="/rooms" className="text-link">
            Browse rooms &amp; suites <ArrowRight size={17} />
          </Link>
        </div>
        <p className="section-intro">
          Every room in the house, listed one by one — pick the exact room you want to stay in.
        </p>
        <div className="inventory-grid">
          {inventory.map((room) => (
            <article className="inventory-card" key={room.id}>
              <div className="inventory-meta">
                <span className="inventory-number">Room {room.roomNumber}</span>
                <span className="inventory-floor">Floor {room.floor ?? 1}</span>
              </div>
              <h3>
                <Link href={`/rooms/${room.typeSlug}`}>{room.typeName}</Link>
              </h3>
              <span className="inventory-kind">
                {room.isSuite ? "The suite collection" : "A guest favourite"}
              </span>
              <div className="inventory-bottom">
                <div>
                  <strong>{formatMoney(room.basePrice, currency, display)}</strong>
                  <span className="rate-unit"> / night</span>
                </div>
                <Button asChild size="sm" className="room-book">
                  <Link href={searchHref(stay, `/rooms/${room.typeSlug}`)}>Book a room</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="why-section">
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">THE SANTO DIFFERENCE</span>
            <h2>It&apos;s the little things that make a stay.</h2>
            <p>Considered spaces. Meaningful moments. Hospitality that feels personal.</p>
          </div>
          <div className="highlights">
            {HIGHLIGHTS.map(([Icon, title, copy]) => (
              <div key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A LITTLE SOMETHING MORE</span>
            <h2>Make the most of your stay.</h2>
          </div>
          <Link href="/offers" className="text-link">
            Discover our offers <ArrowRight size={17} />
          </Link>
        </div>
        <div className="home-offers">
          {OFFERS.slice(0, 2).map((offer, index) => (
            <Link href="/offers" key={offer.name} className="offer-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={index ? "/images/santo-suite.jpg" : "/images/santo-pool.jpg"}
                alt={offer.name}
                loading="lazy"
                width={1536}
                height={1024}
              />
              <div>
                <span className="eyebrow">{offer.eyebrow}</span>
                <h3>{offer.name}</h3>
                <p>{offer.description}</p>
                <span className="text-link">
                  Explore offer <ArrowUpRight size={17} />
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
              <span className="eyebrow">A GLIMPSE OF SANTO</span>
              <h2>Picture yourself here.</h2>
            </div>
            <Button variant="ghost" onClick={() => setGallery(0)}>
              View gallery <ArrowUpRight />
            </Button>
          </div>
          <div className="home-gallery">
            {GALLERY_IMAGES.map((src, index) => (
              <GalleryTile
                key={src}
                image={src}
                label={["Welcoming spaces", "Quiet moments by the pool", "A peaceful room"][index]}
                onClick={() => setGallery(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="container section review-section">
        <div>
          <span className="eyebrow">THE GUEST EXPERIENCE</span>
          <h2>
            Memories worth
            <br />
            coming back for.
          </h2>
        </div>
        <div className="review-quote">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star key={value} size={15} />
            ))}
          </div>
          <blockquote>
            &ldquo;A beautiful space to slow down. Every detail felt thoughtful, and the whole stay
            was wonderfully effortless.&rdquo;
          </blockquote>
          <div className="review-author">
            <span>JT</span>
            <div>
              Jamie T.<small>Leisure stay</small>
            </div>
            <span className="sample-rating">
              9.4<small>Guest rating</small>
            </span>
          </div>
        </div>
      </section>

      <section className="location-band">
        <div className="container location-grid">
          <div>
            <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2>
              A place to arrive.
              <br />A reason to linger.
            </h2>
            <p>Find your way to a more considered stay.</p>
            <p className="address-placeholder">
              <MapPin size={17} />
              {address}
            </p>
            <Button asChild>
              <Link href="/contact">
                Get in touch <ArrowRight />
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
            <small>Map location confirmed at booking</small>
          </div>
        </div>
      </section>

      <Gallery images={[...GALLERY_IMAGES]} open={gallery} setOpen={setGallery} />
    </>
  );
}
