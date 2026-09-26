import Link from "next/link";

export default function Home() {
  return (
    <>
      <nav className="nav">
        <Link className="brand" href="/">
          Santos<span> Hotel</span>
        </Link>
        <div className="navActions">
          <Link className="btn" href="/login">Log in</Link>
          <Link className="btn btnPrimary" href="/register">Sign up</Link>
        </div>
      </nav>

      <section className="hero">
        <h1>Welcome to <span>Santos Hotel</span></h1>
        <p>Experience luxury living in the heart of the city. Book your perfect room today.</p>
        <div className="heroActions">
          <Link className="btn btnPrimary btnLarge" href="/register">Get Started</Link>
          <Link className="btn btnLarge" href="/login">Log in</Link>
        </div>
      </section>

      <section className="features">
        <div className="feature">
          <div className="featureIcon">🍽️</div>
          <h3>Fine Dining</h3>
          <p>Seasonal menus crafted by award-winning chefs.</p>
        </div>
        <div className="feature">
          <div className="featureIcon">💧</div>
          <h3>Wellness & Pool</h3>
          <p>Infinity pool, spa, and 24-hour fitness center.</p>
        </div>
        <div className="feature">
          <div className="featureIcon">📍</div>
          <h3>Prime Location</h3>
          <p>Minutes from downtown with free shuttle service.</p>
        </div>
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} Santos Hotel. All rights reserved.
      </footer>
    </>
  );
}