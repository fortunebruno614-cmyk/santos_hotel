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
import { useT } from "@/components/hotel/locale-provider";

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
  const t = useT();
  const [gallery, setGallery] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!hotel.email) {
      setMessage(t("contact.noEmail"));
      return;
    }
    const subject = encodeURIComponent(
      String(form.get("subject") ?? t("contact.subjectDefault")),
    );
    const body = encodeURIComponent(
      t("contact.mailtoBody", {
        name: String(form.get("name")),
        email: String(form.get("email")),
        message: String(form.get("message")),
      }),
    );
    window.location.href = `mailto:${hotel.email}?subject=${subject}&body=${body}`;
    setMessage(t("contact.openedApp"));
  };

  return (
    <>
      {!contact && (
        <section className="editorial-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/santo-lobby.jpg" alt={t("hotel.hero.alt")} />
          <div className="hero-shade" />
          <div className="container">
            <span className="hero-eyebrow">{t("hotel.hero.eyebrow")}</span>
            <h1>
              {t("hotel.hero.title1")}
              <br />
              {t("hotel.hero.title2")}
            </h1>
            <p>{t("hotel.hero.body")}</p>
          </div>
        </section>
      )}

      <div className="container page-content">
        <Breadcrumb
          current={contact ? t("hotel.breadcrumb.contact") : t("hotel.breadcrumb.hotel")}
        />
        {contact ? (
          <PageHeading
            eyebrow={t("contact.eyebrow")}
            title={t("contact.title")}
            description={t("contact.description")}
          />
        ) : (
          <>
            <div className="hotel-intro">
              <span className="eyebrow">{t("hotel.intro.eyebrow")}</span>
              <h2>
                {t("hotel.intro.title1")}
                <br />
                {t("hotel.intro.title2")}
              </h2>
              <p>{t("hotel.intro.body")}</p>
            </div>
            <div className="home-gallery info-gallery">
              {GALLERY.map((image, index) => (
                <GalleryTile
                  key={image}
                  image={image}
                  label={t("hotel.galleryLabel", { index: index + 1 })}
                  onClick={() => setGallery(index)}
                />
              ))}
            </div>
            <section className="info-section">
              <span className="eyebrow">{t("hotel.amenities.eyebrow")}</span>
              <h2>{t("hotel.amenities.title")}</h2>
              <div className="highlights">
                {(
                  [
                    [Coffee, t("hotel.amenity.dining")],
                    [Waves, t("hotel.amenity.leisure")],
                    [Leaf, t("hotel.amenity.outdoor")],
                    [Wifi, t("hotel.amenity.services")],
                  ] as const
                ).map(([Icon, title]) => (
                  <div key={title}>
                    <Icon />
                    <h3>{title}</h3>
                    <p>{t("hotel.amenities.note")}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="info-section">
              <span className="eyebrow">{t("hotel.faq.eyebrow")}</span>
              <h2>{t("hotel.faq.title")}</h2>
              {(
                [
                  [
                    t("hotel.faq.q.checkIn"),
                    t("hotel.faq.a.checkIn", {
                      inTime: hotel.checkInTime,
                      outTime: hotel.checkOutTime,
                    }),
                  ],
                  [
                    t("hotel.faq.q.cancellation"),
                    t("hotel.faq.a.cancellation", {
                      hours: hotel.cancellationWindowHours,
                    }),
                  ],
                  [t("hotel.faq.q.accessible"), t("hotel.faq.a.accessible")],
                  [t("hotel.faq.q.houseRules"), t("hotel.faq.a.houseRules")],
                  [t("hotel.faq.q.requests"), t("hotel.faq.a.requests")],
                ] as const
              ).map(([question, answer]) => (
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
            <span className="eyebrow">{t("contact.connectEyebrow")}</span>
            <h2>
              {t("contact.connectTitle1")}
              <br />
              {t("contact.connectTitle2")}
            </h2>
            <p>{t("contact.connectBody")}</p>
            <div className="contact-line">
              <MapPin />
              <div>
                <h3>{t("contact.findUs")}</h3>
                <p>{hotel.address}</p>
              </div>
            </div>
            <div className="contact-line">
              <Mail />
              <div>
                <h3>{t("contact.writeUs")}</h3>
                <p>{hotel.email ?? t("contact.emailFallback")}</p>
              </div>
            </div>
            <div className="contact-line">
              <Phone />
              <div>
                <h3>{t("contact.callUs")}</h3>
                <p>{hotel.phone ?? t("contact.phoneFallback")}</p>
              </div>
            </div>
            <div className="static-map small-map">
              <span className="map-pin">
                <MapPin /> {hotel.name.toUpperCase()}
              </span>
              <small>{t("contact.mapNote")}</small>
            </div>
          </div>

          <form className="form-section contact-form" onSubmit={sendMessage}>
            <h3>{t("contact.formTitle")}</h3>
            <p className="tiny-note">{t("contact.formNote")}</p>
            <div className="form-grid">
              <label>
                {t("contact.name")}
                <input
                  name="name"
                  required
                  placeholder="Alex Morgan"
                  autoComplete="name"
                />
              </label>
              <label>
                {t("contact.email")}
                <input
                  name="email"
                  required
                  type="email"
                  placeholder="alex@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="full">
                {t("contact.subjectLabel")}
                <select name="subject" defaultValue={t("contact.subjectDefault")}>
                  <option>{t("contact.subjectDefault")}</option>
                  <option>{t("contact.subjectBooking")}</option>
                  <option>{t("contact.subjectAccessibility")}</option>
                  <option>{t("contact.subjectOccasion")}</option>
                </select>
              </label>
              <label className="full">
                {t("contact.messageLabel")}
                <textarea
                  name="message"
                  rows={5}
                  required
                  placeholder={t("contact.messagePlaceholder")}
                />
              </label>
            </div>
            <Button type="submit">
              {t("contact.send")}
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
            <h2>{t("hotel.bottomTitle")}</h2>
            <Button asChild>
              <Link href="/rooms">
                {t("hotel.exploreRooms")}
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
