import { profile, socials } from "@/content/site";

export default function Footer() {
  return (
    <footer id="contact">
      <div className="wrap">
        <div className="eyebrow reveal" style={{ marginBottom: 20 }}>
          Contact · 05
        </div>
        <a href={`mailto:${profile.email}`} className="contact-big reveal">
          {profile.email} →
        </a>
        <div className="footer-bottom">
          <div className="socials">
            {socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ))}
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} {profile.name} · Tarleton State University
          </div>
        </div>
      </div>
    </footer>
  );
}
