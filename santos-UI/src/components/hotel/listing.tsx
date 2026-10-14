import { useState } from "react";
import { SearchX, RotateCcw, SlidersHorizontal, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading, SearchPanel, RoomCard } from "./shared";
import { rooms } from "@/lib/hotel-data";
import { useBooking } from "./booking-context";
export function Listing({ availability = false }: { availability?: boolean }) {
  const [type, setType] = useState("All");
  const [max, setMax] = useState(400);
  const [bed, setBed] = useState("All");
  const [occupancy, setOccupancy] = useState("Any");
  const [breakfast, setBreakfast] = useState(false);
  const [amenities, setAmenities] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [filters, setFilters] = useState(false);
  const [status, setStatus] = useState("results");
  const { price } = useBooking();
  const reset = () => {
    setType("All");
    setMax(400);
    setBed("All");
    setOccupancy("Any");
    setBreakfast(false);
    setAmenities(false);
    setFlexible(false);
    setStatus("results");
  };
  let results = rooms.filter(
    (r) =>
      (type === "All" || r.category === type) &&
      r.price <= max &&
      (bed === "All" || r.bed === bed) &&
      (occupancy === "Any" || r.guests >= +occupancy) &&
      (!breakfast || r.breakfast),
  );
  results = [...results].sort((a, b) =>
    sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : 0,
  );
  return (
    <div className="container page-content">
      <Breadcrumb current={availability ? "Availability" : "Rooms & Suites"} />
      <PageHeading
        eyebrow={availability ? "YOUR SANTO STAY" : "ROOMS & SUITES"}
        title={availability ? "Your stay starts here." : "Find your perfect stay."}
        description="Beautifully considered rooms. All the space you need to feel at home."
      />
      <SearchPanel compact />
      <div className="listing-layout">
        <aside className={`filters ${filters ? "is-open" : ""}`}>
          <div className="filter-heading">
            <h3>Refine your stay</h3>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
          <fieldset>
            <legend>Room type</legend>
            {["All", "Rooms", "Suites"].map((v) => (
              <label key={v}>
                <input
                  type="radio"
                  name="type"
                  value={v}
                  checked={type === v}
                  onChange={() => setType(v)}
                />
                {v === "All" ? "All accommodation" : v}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Nightly budget</legend>
            <input
              aria-label="Maximum nightly price"
              type="range"
              min="150"
              max="400"
              step="5"
              value={max}
              onChange={(e) => setMax(+e.target.value)}
            />
            <div className="range-labels">
              <span>{price(150)}</span>
              <span>Up to {price(max)}</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>Guests</legend>
            <select
              aria-label="Minimum room capacity"
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value)}
            >
              <option>Any</option>
              <option value="2">2 guests</option>
              <option value="3">3 guests</option>
            </select>
          </fieldset>
          <fieldset>
            <legend>Bed configuration</legend>
            {["All", "1 king bed", "2 twin beds"].map((v) => (
              <label key={v}>
                <input type="radio" name="bed" checked={bed === v} onChange={() => setBed(v)} />
                {v === "All" ? "Any bed type" : v}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>The little extras</legend>
            <label>
              <input
                type="checkbox"
                checked={breakfast}
                onChange={(e) => setBreakfast(e.target.checked)}
              />
              Breakfast included
            </label>
            <label>
              <input
                type="checkbox"
                checked={amenities}
                onChange={(e) => setAmenities(e.target.checked)}
              />
              Wi-Fi
            </label>
            <label>
              <input
                type="checkbox"
                checked={flexible}
                onChange={(e) => setFlexible(e.target.checked)}
              />
              Flexible policy requested
            </label>
          </fieldset>
          <p className="tiny-note">
            Sample room features. Hotel policies and inclusions to be confirmed.
          </p>
          <Button className="filter-done" onClick={() => setFilters(false)}>
            Show rooms
          </Button>
        </aside>
        <section className="listing-results">
          <div className="results-toolbar">
            <div>
              <h3>
                {results.length} {results.length === 1 ? "room" : "rooms"} to make your own
              </h3>
              <small>Demonstration results · Not live availability</small>
            </div>
            <Button
              variant="outline"
              className="filter-toggle"
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal />
              Filters
            </Button>
            <label className="sort-label">
              Sort by{" "}
              <select
                aria-label="Sort rooms"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </label>
          </div>
          {availability && (
            <div className="demo-state">
              <label>
                Preview state{" "}
                <select
                  aria-label="Results preview state"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="results">Results</option>
                  <option value="loading">Loading</option>
                  <option value="error">Error</option>
                  <option value="empty">No results</option>
                </select>
              </label>
            </div>
          )}
          {status === "loading" ? (
            <div aria-label="Loading rooms" className="skeleton-list">
              {[1, 2, 3].map((i) => (
                <div key={i} />
              ))}
            </div>
          ) : status === "error" ? (
            <div className="empty-state">
              <AlertCircle />
              <h2>A momentary pause.</h2>
              <p>We couldn’t show these sample rooms. Please try again.</p>
              <Button onClick={() => setStatus("results")}>
                <RotateCcw />
                Try again
              </Button>
            </div>
          ) : results.length === 0 || status === "empty" ? (
            <div className="empty-state">
              <SearchX />
              <h2>Let’s find another fit.</h2>
              <p>No sample rooms match these filters. Try widening your search.</p>
              <Button onClick={reset}>Clear filters</Button>
            </div>
          ) : (
            results.map((r) => <RoomCard key={r.id} room={r} horizontal />)
          )}
          <p className="tiny-note">
            All prices are illustrative. Mock taxes and fees are shown at checkout. No actual
            inventory is checked.
          </p>
        </section>
      </div>
    </div>
  );
}
