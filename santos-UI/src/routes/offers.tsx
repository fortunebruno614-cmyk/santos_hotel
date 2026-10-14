import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { offers, meta } from "@/lib/hotel-data";
import { Breadcrumb } from "@/components/hotel/shared";
import pool from "@/assets/santo-pool.jpg";
import suite from "@/assets/santo-suite.jpg";
import room from "@/assets/santo-room.jpg";
export const Route = createFileRoute("/offers")({
  head: () =>
    meta(
      "A little something more",
      "Discover illustrative Santo Hotel stay packages for slow weekends, longer escapes and time together.",
    ),
  component: Offers,
});
function Offers() {
  const [open, setOpen] = useState<number | null>(null);
  const offer = open === null ? null : offers[open];
  return (
    <>
      <section className="editorial-hero">
        <img src={pool} alt="A peaceful courtyard pool" />
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
          {offers.map((o, i) => (
            <article className="offer-card" key={o.id}>
              <img src={[pool, suite, room][i]} alt={o.name} />
              <div>
                <span className="eyebrow">{o.eyebrow}</span>
                <h3>{o.name}</h3>
                <p>{o.description}</p>
                <p className="tiny-note">
                  Sample package · Dates, eligibility and inclusions to be confirmed.
                </p>
                <Button variant="link" onClick={() => setOpen(i)}>
                  Explore offer
                  <ArrowUpRight />
                </Button>
              </div>
            </article>
          ))}
        </div>
        <p className="tiny-note">
          Illustrative campaigns only. No actual discounts, promotional availability or guaranteed
          savings are offered.
        </p>
      </div>
      <Dialog open={offer !== null} onOpenChange={() => setOpen(null)}>
        <DialogContent className="offer-dialog">
          <DialogTitle>{offer?.name}</DialogTitle>
          <DialogDescription>{offer?.description}</DialogDescription>
          <img src={[pool, suite, room][open ?? 0]} alt={offer?.name} />
          <h3>A stay to look forward to</h3>
          <p>
            This sample package brings together a beautiful room and time to enjoy it. Actual
            inclusions will be confirmed by Santo Hotel.
          </p>
          <dl className="offer-terms">
            <dt>Applicable dates</dt>
            <dd>To be confirmed</dd>
            <dt>Eligibility</dt>
            <dd>To be confirmed</dd>
            <dt>Terms & inclusions</dt>
            <dd>Hotel-approved details pending</dd>
          </dl>
          <Button asChild onClick={() => setOpen(null)}>
            <Link to="/rooms">
              Explore accommodation
              <ArrowRight />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
