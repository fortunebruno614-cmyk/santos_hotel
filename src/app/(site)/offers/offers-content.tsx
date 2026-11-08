"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Breadcrumb } from "@/components/hotel/shared";
import { useT } from "@/components/hotel/locale-provider";
import type { Dictionary } from "@/lib/dictionaries";

/** Offer copy is keyed to the shared home-page offer entries, not literal. */
const OFFERS = [
  { id: "slow-weekend", key: "home.offer.slow", image: "/images/santo-pool.jpg" },
  { id: "stay-a-little-longer", key: "home.offer.longer", image: "/images/santo-suite.jpg" },
  { id: "together-at-santo", key: "home.offer.together", image: "/images/santo-room.jpg" },
] as const;

export function OffersContent() {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const offer = open === null ? null : OFFERS[open];
  const offerName = (key: string) => t(`${key}.name` as keyof Dictionary);
  const offerDesc = (key: string) => t(`${key}.desc` as keyof Dictionary);
  const offerEyebrow = (key: string) => t(`${key}.eyebrow` as keyof Dictionary);

  return (
    <>
      <section className="editorial-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/santo-pool.jpg" alt={t("offers.hero.alt")} />
        <div className="hero-shade" />
        <div className="container">
          <span className="hero-eyebrow">{t("offers.hero.eyebrow")}</span>
          <h1>
            {t("offers.hero.title1")}
            <br />
            {t("offers.hero.title2")}
          </h1>
          <p>{t("offers.hero.body")}</p>
        </div>
      </section>

      <div className="container page-content">
        <Breadcrumb current={t("nav.offers")} />
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("offers.eyebrow")}</span>
            <h2>{t("offers.title")}</h2>
          </div>
        </div>
        <div className="offer-grid">
          {OFFERS.map((item, index) => (
            <article className="offer-card" key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={offerName(item.key)} />
              <div>
                <span className="eyebrow">{offerEyebrow(item.key)}</span>
                <h3>{offerName(item.key)}</h3>
                <p>{offerDesc(item.key)}</p>
                <p className="tiny-note">{t("offers.note")}</p>
                <Button variant="link" onClick={() => setOpen(index)}>
                  {t("home.offers.explore")}
                  <ArrowUpRight />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <Dialog open={offer !== null} onOpenChange={() => setOpen(null)}>
        <DialogContent className="offer-dialog">
          <DialogTitle>{offer ? offerName(offer.key) : ""}</DialogTitle>
          <DialogDescription>{offer ? offerDesc(offer.key) : ""}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer?.image} alt={offer ? offerName(offer.key) : ""} />
          <h3>{t("offers.dialogTitle")}</h3>
          <p>{t("offers.dialogBody")}</p>
          <dl className="offer-terms">
            <dt>{t("offers.applicableDates")}</dt>
            <dd>{t("offers.contactHotel")}</dd>
            <dt>{t("offers.eligibility")}</dt>
            <dd>{t("offers.contactHotel")}</dd>
            <dt>{t("offers.termsInclusions")}</dt>
            <dd>{t("offers.confirmedAtBooking")}</dd>
          </dl>
          <Button asChild onClick={() => setOpen(null)}>
            <Link href="/rooms">
              {t("offers.exploreAccommodation")}
              <ArrowRight />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
