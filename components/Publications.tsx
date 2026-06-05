import { publications } from "@/content/site";

export default function Publications() {
  return (
    <section id="publications">
      <div className="wrap">
        <div className="sec-head reveal">
          <div>
            <div className="eyebrow">Selected Publications · 03</div>
            <h2>Recent work.</h2>
          </div>
          <a href="#" className="sec-link">
            Full list on Google Scholar →
          </a>
        </div>

        {publications.map((p, i) => (
          <a href={p.url} className="pub-row reveal" key={i}>
            <span className="pub-year">{p.year}</span>
            <span>
              <span className="pub-title">{p.title}</span>
              <div className="pub-venue">{p.venue}</div>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
