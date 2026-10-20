import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { ProductCard, SkeletonGrid } from "../components/ui.jsx";

const TILES = [
  { slug: "apparel", title: "Apparel", sub: "Linen, cotton & natural fabrics", bg: "linear-gradient(135deg,#1A3D2B,#2D6A4F)" },
  { slug: "home", title: "Home & Living", sub: "Eco stoneware, bamboo & weave", bg: "linear-gradient(135deg,#2D6A4F,#52B788)" },
  { slug: "accessories", title: "Accessories", sub: "Jute, canvas & organic silk", bg: "linear-gradient(135deg,#0d2618,#1A3D2B)" },
];

const SLIDES = [
  {
    img: "/img/festival-banner.png",
    alt: "Great Garden Festival — Buy 2 Get 3rd at 50% Off · Live Now",
    fit: "cover",
    link: "/search",
  },
  {
    img: "/img/poster2.png",
    alt: "A Little Plant, A Lot of Love — Plants Starting at Just Rs.199",
    fit: "cover",
    link: "/category/home",
  },
  {
    img: "/img/poster3.png",
    alt: "Last Chance for Festival Savings — Great Garden Festival",
    fit: "cover",
    link: "/search",
  },
];

const FESTIVAL_DEALS = [
  { img: "/img/deal1.png", title: "Festive Pots, Beautiful Corners", link: "/search?q=pot" },
  { img: "/img/deal2.png", title: "Lift Your Greens for Less", link: "/search?q=stand" },
  { img: "/img/deal3.png", title: "Happier Greens, Festive Savings", link: "/search?q=fertilizer" },
  { img: "/img/deal4.png", title: "Little Helpers, Lovely Savings", link: "/search?q=care" },
  { img: "/img/deal5.png", title: "Fresh Greens, Festive Joy", link: "/category/home" },
  { img: "/img/deal6.png", title: "Better Tools, Festive Savings", link: "/category/accessories" },
];

function FestivalDealsSection() {
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 35, seconds: 20 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const format = (n) => String(n).padStart(2, "0");

  return (
    <section className="festival-deals-wrap" aria-label="Festival Deals">
      <div className="festival-header">
        <div className="festival-title-block">
          <span className="festival-badge">⚡ LIMITED TIME FESTIVAL SPECIAL</span>
          <h2>Final Hours. Festival Savings Are Ending!</h2>
          <p>
            Buy 2, Get 3rd at <strong>50% OFF</strong> across all festive gardening essentials
          </p>
        </div>
        <div className="festival-timer-box">
          <span className="timer-label">OFFER ENDS IN</span>
          <div className="timer-digits">
            <div className="timer-unit">
              <span>{format(timeLeft.hours)}</span>
              <small>HRS</small>
            </div>
            <span className="timer-colon">:</span>
            <div className="timer-unit">
              <span>{format(timeLeft.minutes)}</span>
              <small>MIN</small>
            </div>
            <span className="timer-colon">:</span>
            <div className="timer-unit">
              <span>{format(timeLeft.seconds)}</span>
              <small>SEC</small>
            </div>
          </div>
        </div>
      </div>

      <div className="festival-grid">
        {FESTIVAL_DEALS.map((deal, i) => (
          <Link key={i} to={deal.link} className="festival-card" title={deal.title}>
            <div className="festival-card-media">
              <img src={deal.img} alt={deal.title} loading="lazy" />
            </div>
            <div className="festival-card-btn">
              <span>Shop Deal →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroBanner() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  const goTo = useCallback((idx) => {
    setActive(idx);
  }, []);

  const next = useCallback(() => goTo((active + 1) % SLIDES.length), [active, goTo]);
  const prev = useCallback(() => goTo((active - 1 + SLIDES.length) % SLIDES.length), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [paused, next]);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 40) next();
    else if (diff < -40) prev();
    setTouchStart(null);
  };

  return (
    <div
      className="hero-banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
      role="region"
      aria-label="Promotional Posters Slideshow"
    >
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={`hero-slide${i === active ? " hero-slide--active" : ""}`}
          aria-hidden={i !== active}
        >
          {/* Ambient blurred backdrop for soft luxury glow & handling different aspect ratios */}
          <div
            className="hero-slide-bg"
            style={{ backgroundImage: `url(${s.img})` }}
            aria-hidden="true"
          />
          <Link to={s.link} className="hero-slide-link" tabIndex={i === active ? 0 : -1}>
            <img
              src={s.img}
              alt={s.alt}
              className={`hero-img hero-img--${s.fit}`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </Link>
        </div>
      ))}

      {/* Prev / Next navigation arrows */}
      <button
        className="hero-arrow hero-arrow--prev"
        onClick={(e) => { e.preventDefault(); prev(); }}
        aria-label="Previous banner"
      >
        ‹
      </button>
      <button
        className="hero-arrow hero-arrow--next"
        onClick={(e) => { e.preventDefault(); next(); }}
        aria-label="Next banner"
      >
        ›
      </button>

      {/* Dot indicators */}
      <div className="hero-dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`hero-dot${i === active ? " hero-dot--active" : ""}`}
            onClick={(e) => { e.preventDefault(); goTo(i); }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* 5-second animated progress bar */}
      <div className="hero-progress" key={`${active}-${paused}`}>
        {!paused && <div className="hero-progress-bar" />}
      </div>
    </div>
  );
}

export default function Home() {
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    api.get("/api/products?limit=8").then((d) => setLatest(d.items)).catch(() => setLatest([]));
  }, []);

  return (
    <>
      <HeroBanner />

      <FestivalDealsSection />

      <div className="section-head"><h2>Shop by category</h2></div>
      <div className="cat-tiles">
        {TILES.map((t) => (
          <Link key={t.slug} className="cat-tile" to={`/category/${t.slug}`} style={{ background: t.bg }}>
            <h3>{t.title}</h3><span>{t.sub}</span>
          </Link>
        ))}
      </div>

      <div className="section-head">
        <h2>New arrivals</h2>
        <Link to="/search?sort=new">View all →</Link>
      </div>
      {latest === null ? <SkeletonGrid n={4} /> : (
        <div className="grid">{latest.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}

      <div className="section-head">
        <h2>Bestsellers</h2>
        <Link to="/search">View all →</Link>
      </div>
      {latest === null ? <SkeletonGrid n={4} /> : (
        <div className="grid">{latest.slice(4, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}

      <div className="trust-row">
        {[
          ["🚚", "Honest shipping", "Free across India above Rs.1,999. Dispatched in 24-48 hrs."],
          ["🌱", "Eco-friendly", "All products are sustainably sourced and responsibly made."],
          ["↩️", "7-day returns", "Easy returns on unused items, no questions asked."],
          ["🛡️", "Verified payments", "Every QR payment is manually verified before dispatch."],
        ].map(([icon, h, p]) => (
          <div className="trust-card" key={h}>
            <div className="t-icon">{icon}</div><h4>{h}</h4><p>{p}</p>
          </div>
        ))}
      </div>
    </>
  );
}
