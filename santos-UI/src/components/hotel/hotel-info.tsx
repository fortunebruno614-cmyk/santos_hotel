import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone, ArrowRight, Check, Leaf, Coffee, Waves, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading, Gallery } from "./shared";
import { lobby, room } from "@/lib/hotel-data";
import pool from "@/assets/santo-pool.jpg";
export function HotelInfo({ contact = false }: { contact?: boolean }) {
  const [gallery, setGallery] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <>
      {!contact && (
        <section className="editorial-hero">
          <img src={lobby} alt="The welcoming Santo lobby" />
          <div className="hero-shade" />
          <div className="container">
            <span className="hero-eyebrow">GET TO KNOW SANTO</span>
            <h1>
              Thoughtful by nature.
              <br />
              Welcoming at heart.
            </h1>
            <p>A place for the moments that matter.</p>
          </div>
        </section>
      )}
      <div className="container page-content">
        <Breadcrumb current={contact ? "Contact" : "The Hotel"} />
        {contact ? (
          <PageHeading
            eyebrow="WE’D LOVE TO HEAR FROM YOU"
            title="Every stay starts with hello."
            description="A question, a special occasion, or a little help planning your stay."
          />
        ) : (
          <>
            <div className="hotel-intro">
              <span className="eyebrow">THE SANTO WAY</span>
              <h2>
                A little less ordinary.
                <br />A little more you.
              </h2>
              <p>
                At Santo, the idea is simple: beautiful spaces, considered comforts, and a welcome
                that feels genuine. This is a glimpse of the hospitality we imagine — a place to
                pause, connect, and settle into your own rhythm.
              </p>
            </div>
            <div className="home-gallery info-gallery">
              {[lobby, pool, room].map((src, i) => (
                <Button
                  variant="ghost"
                  className="gallery-tile"
                  key={src}
                  onClick={() => setGallery(i)}
                  aria-label={`Open property photo ${i + 1}`}
                >
                  <img src={src} alt="Illustrative property space" />
                </Button>
              ))}
            </div>
            <p className="tiny-note">
              Illustrative property imagery. Hotel features and facilities are not yet verified.
            </p>
            <section className="info-section">
              <span className="eyebrow">ROOM TO ENJOY</span>
              <h2>Considered comforts, throughout.</h2>
              <div className="highlights">
                {[
                  [Coffee, "Dining & gathering"],
                  [Waves, "Leisure & relaxation"],
                  [Leaf, "Outdoor spaces"],
                  [Wifi, "Guest services"],
                ].map(([Icon, title]) => {
                  const I = Icon as typeof Coffee;
                  return (
                    <div key={String(title)}>
                      <I />
                      <h3>{String(title)}</h3>
                      <p>Details to be confirmed by the hotel.</p>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="info-section">
              <span className="eyebrow">GOOD TO KNOW</span>
              <h2>A few helpful details.</h2>
              {[
                [
                  "When can I check in and check out?",
                  "Check-in and check-out times are to be confirmed by the hotel.",
                ],
                [
                  "What is the cancellation policy?",
                  "Cancellation terms and any applicable charges will be shown once confirmed. All current booking data is illustrative.",
                ],
                [
                  "Are accessible rooms available?",
                  "Room accessibility and step-free facilities are awaiting hotel confirmation. Please check with the team before planning your visit.",
                ],
                [
                  "What are the house rules?",
                  "Smoking, pet, visitor and quiet-hour policies will be confirmed by the hotel.",
                ],
                [
                  "Can I make a special request?",
                  "Special requests may be included in the sample booking form. No requests are transmitted in this prototype.",
                ],
              ].map(([q, a]) => (
                <details className="faq" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </section>
          </>
        )}
        <section className="contact-layout">
          <div>
            <span className="eyebrow">LET’S CONNECT</span>
            <h2>
              A warm welcome
              <br />
              is just the beginning.
            </h2>
            <p>
              For booking assistance or questions about your stay, our contact details will be
              available here.
            </p>
            <div className="contact-line">
              <MapPin />
              <div>
                <h3>Find us</h3>
                <p>Hotel address to be confirmed</p>
              </div>
            </div>
            <div className="contact-line">
              <Mail />
              <div>
                <h3>Write to us</h3>
                <p>Email address to be confirmed</p>
              </div>
            </div>
            <div className="contact-line">
              <Phone />
              <div>
                <h3>Give us a call</h3>
                <p>Phone number to be confirmed</p>
              </div>
            </div>
            <div className="static-map small-map">
              <span className="map-pin">
                <MapPin /> SANTO HOTEL
              </span>
              <small>Illustrative map · Exact location pending</small>
            </div>
          </div>
          <form
            className="form-section contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <h3>A little note for our team</h3>
            <p className="tiny-note">
              Presentation only. Use sample details; no messages are sent.
            </p>
            <div className="form-grid">
              <label>
                Your name *<input required placeholder="Alex Morgan" />
              </label>
              <label>
                Email address *<input required type="email" placeholder="alex@example.com" />
              </label>
              <label className="full">
                What’s on your mind?
                <select>
                  <option>General enquiry</option>
                  <option>Booking assistance</option>
                  <option>Accessibility</option>
                  <option>Special occasion</option>
                </select>
              </label>
              <label className="full">
                Your message *
                <textarea
                  rows={5}
                  required
                  placeholder="How can we make your stay more considered?"
                />
              </label>
            </div>
            <Button type="submit">
              Preview message
              <ArrowRight />
            </Button>
            {sent && (
              <div className="info-notice" role="status">
                <Check />
                <p>Your sample message is ready. Nothing has been sent or saved.</p>
              </div>
            )}
          </form>
        </section>
        {!contact && (
          <div className="info-bottom">
            <h2>Find your own Santo moment.</h2>
            <Button asChild>
              <Link to="/rooms">
                Explore our rooms
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </div>
      <Gallery images={[lobby, pool, room]} open={gallery} setOpen={setGallery} />
    </>
  );
}
