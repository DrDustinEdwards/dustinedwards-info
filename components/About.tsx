import { about } from "@/content/site";

export default function About() {
  return (
    <section id="about">
      <div className="wrap">
        <div className="sec-head reveal">
          <div>
            <div className="eyebrow">About · 04</div>
            <h2>About Dustin.</h2>
          </div>
        </div>

        <div className="about-grid">
          <div className="reveal">
            {about.paragraphs.map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
            ))}
          </div>
          <div className="now-card reveal">
            <div className="label">At a glance</div>
            <ul>
              {about.glance.map((g) => (
                <li key={g.text}>
                  {g.text} <span>{g.tag}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
