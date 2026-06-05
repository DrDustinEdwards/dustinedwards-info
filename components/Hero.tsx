import { profile } from "@/content/site";

export default function Hero() {
  return (
    <header className="hero">
      <div className="wrap">
        <div className="eyebrow">{profile.role}</div>
        <h1>
          {profile.headlineLead}
          <em>{profile.headlineAccent}</em>
          {profile.headlineTrail}
        </h1>
        <p className="lede">{profile.lede}</p>
        <div className="hero-actions">
          <a href="#research" className="btn primary">
            See the research →
          </a>
          <a href="#contact" className="btn ghost">
            Get in touch
          </a>
        </div>
      </div>
    </header>
  );
}
