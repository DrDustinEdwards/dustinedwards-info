import { research, program } from "@/content/site";

export default function Research() {
  return (
    <section id="research">
      <div className="wrap">
        <div className="sec-head reveal">
          <div>
            <div className="eyebrow">Research · 01</div>
            <h2>What the lab works on.</h2>
          </div>
          <a href="#" className="sec-link">
            Lab knowledge base →
          </a>
        </div>

        <div className="research-grid">
          {research.map((r) => (
            <div className="rcard reveal" key={r.title}>
              <div className="num">{r.num}</div>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </div>
          ))}
        </div>

        <div className="band reveal">
          <div className="eyebrow">{program.eyebrow}</div>
          <h3>{program.title}</h3>
          <p>{program.body}</p>
          <div className="stats">
            {program.stats.map((s) => (
              <div className="stat" key={s.l}>
                <div className="n">{s.n}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
