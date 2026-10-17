"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Coffee,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Waves,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, Gallery, GalleryTile, PageHeading } from "@/components/hotel/shared";

const GALLERY = [
  "/images/santo-lobby.jpg",
  "/images/santo-pool.jpg",
  "/images/santo-room.jpg",
] as const;

export type HotelInfoProfile = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationWindowHours: number;
};

export function HotelInfo({ hotel, contact = false }: { hotel: HotelInfoProfile; contact?: boolean }) {
  const [gallery, setGallery] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!hotel.email) {
      setMessage("Our email address is being confirmed. Please call the hotel for now.");
      return;
    }
    const subject = encodeURIComponent(String(form.get("subject") ?? "General enquiry"));
    const body = encodeURIComponent(
      `Name: ${form.get("name")}\nEmail: ${form.get("email")}\n\n${form.get("message")}`,
    );
    window.location.href = `mailto:${hotel.email}?subject=${subject}&body=${body}`;
    setMessage("Your email app should open with your message ready to send.");
  };

  return (
    <>
      {!contact && (
        <section className="editorial-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/santo-lobby.jpg" alt="The welcoming Santo lobby" />
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
            eyebrow="WE'D LOVE TO HEAR FROM YOU"
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
                that feels genuine. A place to pause, connect, and settle into your own rhythm.
              </p>
            </div>
            <div className="home-gallery info-gallery">
              {GALLERY.map((image, index) => (
                <GalleryTile
                  key={image}
                  image={image}
                  label={`Open property photo ${index + 1}`}
                  onClick={() => setGallery(index)}
                />
              ))}
            </div>
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
                  const IconComponent = Icon as typeof Coffee;
                  return (
                    <div key={String(title)}>
                      <IconComponent />
                      <h3>{String(title)}</h3>
                      <p>Ask our team for the latest details during your stay.</p>
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
                  `Check-in is from ${hotel.checkInTime} and check-out is by ${hotel.checkOutTime}.`,
                ],
                [
                  "What is the cancellation policy?",
                  `Free cancellation is available up to ${hotel.cancellationWindowHours} hours before check-in. Later cancellations are subject to the hotel's terms.`,
                ],
                [
                  "Are accessible rooms available?",
                  "Room accessibility and step-free facilities vary by room type. Please contact the hotel before planning your visit.",
                ],
                [
                  "What are the house rules?",
                  "Smoking, pet, visitor and quiet-hour policies are confirmed by the hotel at check-in.",
                ],
                [
                  "Can I make a special request?",
                  "Yes — add your request during checkout or contact the hotel directly. Requests are subject to availability.",
                ],
              ].map(([question, answer]) => (
                <details className="faq" key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </section>
          </>
        )}

        <section className="contact-layout">
          <div>
            <span className="eyebrow">LET&apos;S CONNECT</span>
            <h2>
              A warm welcome
              <br />
              is just the beginning.
            </h2>
            <p>For booking assistance or questions about your stay, our team is here to help.</p>
            <div className="contact-line">
              <MapPin />
              <div>
                <h3>Find us</h3>
                <p>{hotel.address}</p>
              </div>
            </div>
            <div className="contact-line">
              <Mail />
              <div>
                <h3>Write to us</h3>
                <p>{hotel.email ?? "Email address to be confirmed"}</p>
              </div>
            </div>
            <div className="contact-line">
              <Phone />
              <div>
                <h3>Give us a call</h3>
                <p>{hotel.phone ?? "Phone number to be confirmed"}</p>
              </div>
            </div>
            <div className="static-map small-map">
              <span className="map-pin">
                <MapPin /> {hotel.name.toUpperCase()}
              </span>
              <small>Exact directions confirmed at booking</small>
            </div>
          </div>

          <form className="form-section contact-form" onSubmit={sendMessage}>
            <h3>A little note for our team</h3>
            <p className="tiny-note">
              This form opens your email app so your message reaches the hotel directly.
            </p>
            <div className="form-grid">
              <label>
                Your name *
                <input name="name" required placeholder="Alex Morgan" autoComplete="name" />
              </label>
              <label>
                Email address *
                <input
                  name="email"
                  required
                  type="email"
                  placeholder="alex@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="full">
                What&apos;s on your mind?
                <select name="subject">
                  <option>General enquiry</option>
                  <option>Booking assistance</option>
                  <option>Accessibility</option>
                  <option>Special occasion</option>
                </select>
              </label>
              <label className="full">
                Your message *
                <textarea
                  name="message"
                  rows={5}
                  required
                  placeholder="How can we make your stay more considered?"
                />
              </label>
            </div>
            <Button type="submit">
              Send message
              <ArrowRight />
            </Button>
            {message && (
              <div className="info-notice" role="status">
                <Check />
                <p>{message}</p>
              </div>
            )}
          </form>
        </section>

        {!contact && (
          <div className="info-bottom">
            <h2>Find your own Santo moment.</h2>
            <Button asChild>
              <Link href="/rooms">
                Explore our rooms
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </div>

      <Gallery images={[...GALLERY]} open={gallery} setOpen={setGallery} />
    </>
  );
}
