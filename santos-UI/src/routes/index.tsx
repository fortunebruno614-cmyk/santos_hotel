import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Leaf,
  HeartHandshake,
  Coffee,
  Sparkles,
  Star,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchPanel, RoomCard, Gallery } from "@/components/hotel/shared";
import { lobby, room, rooms, offers, meta } from "@/lib/hotel-data";
import suite from "@/assets/santo-suite.jpg";
import pool from "@/assets/santo-pool.jpg";
export const Route = createFileRoute("/")({
  head: () =>
    meta(
      "A considered stay. A genuine welcome.",
      "Discover Santo Hotel, thoughtfully designed rooms, considered comforts, and a genuine welcome. Explore our demonstration hotel experience.",
    ),
  component: Home,
});
function Home() {
  const [gallery, setGallery] = useState<number | null>(null);
  return (
    <>
      <section className="home-hero">
        <img
          className="hero-image"
          src={lobby}
          alt="A welcoming Santo Hotel lobby with natural materials and garden views"
          width={1920}
          height={1024}
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="hero-eyebrow">
            <span /> A WARM WELCOME TO SANTO HOTEL
          </span>
          <h1>
            Your Stay,
            <br />
            <em>Thoughtfully</em> Designed.
          </h1>
          <p>
            Discover comfort, exceptional hospitality, and a stay
            <br className="desktop-break" /> tailored to you at Santo Hotel.
          </p>
          <Button asChild variant="outline" className="hero-explore">
            <Link to="/rooms">
              Find your kind of comfort <ArrowUpRight />
            </Link>
          </Button>
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
        <SearchPanel />
        <div className="search-reassurance">
          <span>
            <CheckIcon /> Your stay, your way
          </span>
          <span>
            <CheckIcon /> Clear prices, no surprises
          </span>
          <span>
            <CheckIcon /> A warm welcome awaits
          </span>
          <small>Illustrative stays & rates · No real reservations</small>
        </div>
      </div>
      <section className="container section featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ROOMS & SUITES</span>
            <h2>A space to call your own.</h2>
          </div>
          <Link to="/rooms" className="text-link">
            Explore all rooms <ArrowRight size={17} />
          </Link>
        </div>
        <p className="section-intro">
          Unwind in thoughtfully designed spaces, where every detail feels just right.
        </p>
        <div className="room-grid">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} />
          ))}
        </div>
        <p className="tiny-note">
          Sample room types, amenities and nightly rates. Final hotel details to be confirmed.
        </p>
      </section>
      <section className="why-section">
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">THE SANTO DIFFERENCE</span>
            <h2>It’s the little things that make a stay.</h2>
            <p>Considered spaces. Meaningful moments. Hospitality that feels personal.</p>
          </div>
          <div className="highlights">
            {[
              [
                Leaf,
                "Thoughtfully designed",
                "Spaces that balance beautiful details with everyday comfort.",
              ],
              [
                HeartHandshake,
                "A genuine welcome",
                "A thoughtful approach to making you feel at home.",
              ],
              [
                Coffee,
                "Room to slow down",
                "Unhurried mornings and the simple pleasure of being here.",
              ],
              [Sparkles, "Comfort, considered", "The little touches that make all the difference."],
            ].map(([Icon, title, copy]) => {
              const I = Icon as typeof Leaf;
              return (
                <div key={String(title)}>
                  <I />
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A LITTLE SOMETHING MORE</span>
            <h2>Make the most of your stay.</h2>
          </div>
          <Link to="/offers" className="text-link">
            Discover our offers <ArrowRight size={17} />
          </Link>
        </div>
        <div className="home-offers">
          {offers.slice(0, 2).map((o, i) => (
            <Link to="/offers" key={o.id} className="offer-preview">
              <img src={i ? suite : pool} alt={o.name} loading="lazy" width={1536} height={1024} />
              <div>
                <span className="eyebrow">{o.eyebrow}</span>
                <h3>{o.name}</h3>
                <p>{o.description}</p>
                <span className="text-link">
                  Explore offer <ArrowUpRight size={17} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="tiny-note">
          Illustrative offers. Inclusions, dates and terms to be confirmed.
        </p>
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
            {[lobby, pool, room].map((src, i) => (
              <Button
                className="gallery-tile"
                variant="ghost"
                key={src}
                onClick={() => setGallery(i)}
                aria-label={`Open gallery image ${i + 1}`}
              >
                <img
                  src={src}
                  alt={["Welcoming spaces", "Quiet moments by the pool", "A peaceful room"][i]}
                  width={1536}
                  height={1024}
                  loading="lazy"
                />
              </Button>
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
          <p className="tiny-note">
            Sample review · Demonstration content, not a verified guest review.
          </p>
        </div>
        <div className="review-quote">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={15} />
            ))}
          </div>
          <blockquote>
            “A beautiful space to slow down. Every detail felt thoughtful, and the whole stay was
            wonderfully effortless.”
          </blockquote>
          <div className="review-author">
            <span>JT</span>
            <div>
              Jamie T.<small>Sample guest · Leisure stay</small>
            </div>
            <span className="sample-rating">
              9.4<small>Sample rating</small>
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
              Hotel address & nearby attractions to be confirmed.
            </p>
            <Button asChild>
              <Link to="/contact">
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
              SANTO HOTEL
            </span>
            <small>Illustrative map · Location to be confirmed</small>
          </div>
        </div>
      </section>
      <Gallery images={[lobby, pool, room]} open={gallery} setOpen={setGallery} />
    </>
  );
}
function CheckIcon() {
  return <span className="small-check">✓</span>;
}
