"use client";

import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { profile, navLinks } from "@/content/site";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={scrolled ? "scrolled" : ""}>
      <div className="nav-inner">
        <a href="#top" className="wordmark">
          <span className="dot" />
          {profile.name}
        </a>
        <div className="nav-links">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={link.label === "Contact" ? "" : "hide-m"}
            >
              {link.label}
            </a>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
