"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Breadcrumb } from "@/components/hotel/shared";

const OFFERS = [
  {
    id: "slow-weekend",
    name: "The Slow Weekend",
    eyebrow: "MAKE TIME FOR YOURSELF",
    description: "Trade your everyday rhythm for unhurried mornings and a well-deserved escape.",
    image: "/images/santo-pool.jpg",
  },
  {
    id: "stay-a-little-longer",
    name: "Stay a Little Longer",
    eyebrow: "MORE TIME, MORE MEMORIES",
    description: "Settle in, explore at your own pace, and make yourself at home.",
    image: "/images/santo-suite.jpg",
  },
  {
    id: "together-at-santo",
    name: "Together at Santo",
    eyebrow: "MOMENTS WORTH SHARING",
    description: "A thoughtful setting for a special occasion or simply time together.",
    image: "/images/santo-room.jpg",
  },
];

export function OffersContent() {
  const [open, setOpen] = useState<number | null>(null);
  const offer = open === null ? null : OFFERS[open];

  return (
    <>
      <section className="editorial-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/santo-pool.jpg" alt="A peaceful courtyard pool" />
        <div className="hero-shade" />
        <div className="container">
          <span className="hero-eyebrow">A LITTLE SOMETHING MORE</span>
          <h1>
            More reasons
            <br />
            to make it Santo.
          </h1>
          <p>Thoughtful ideas for a stay that feels like you.</p>
        </div>
      </section>

      <div className="container page-content">
        <Breadcrumb current="Offers" />
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURATED STAYS</span>
            <h2>Your time. Beautifully spent.</h2>
          </div>
        </div>
        <div className="offer-grid">
          {OFFERS.map((item, index) => (
            <article className="offer-card" key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.name} />
              <div>
                <span className="eyebrow">{item.eyebrow}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <p className="tiny-note">
                  Ask our reservations team about dates, eligibility and inclusions.
                </p>
                <Button variant="link" onClick={() => setOpen(index)}>
                  Explore offer
                  <ArrowUpRight />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <Dialog open={offer !== null} onOpenChange={() => setOpen(null)}>
        <DialogContent className="offer-dialog">
          <DialogTitle>{offer?.name}</DialogTitle>
          <DialogDescription>{offer?.description}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer?.image} alt={offer?.name} />
          <h3>A stay to look forward to</h3>
          <p>
            This package brings together a beautiful room and time to enjoy it. Contact our team to
            confirm the details for your dates.
          </p>
          <dl className="offer-terms">
            <dt>Applicable dates</dt>
            <dd>Contact the hotel</dd>
            <dt>Eligibility</dt>
            <dd>Contact the hotel</dd>
            <dt>Terms & inclusions</dt>
            <dd>Confirmed at booking</dd>
          </dl>
          <Button asChild onClick={() => setOpen(null)}>
            <Link href="/rooms">
              Explore accommodation
              <ArrowRight />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
