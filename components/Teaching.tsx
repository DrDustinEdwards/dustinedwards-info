import { courses } from "@/content/site";

export default function Teaching() {
  return (
    <section id="teaching">
      <div className="wrap">
        <div className="sec-head reveal">
          <div>
            <div className="eyebrow">Teaching · 02</div>
            <h2>Courses &amp; mentoring.</h2>
          </div>
          <a href="#" className="sec-link">
            Teaching philosophy →
          </a>
        </div>

        <div className="teach-grid">
          <div className="teach-col reveal">
            <h4>Lecture courses</h4>
            {courses.lecture.map((c) => (
              <div className="course" key={c.name}>
                <span className="cn">{c.name}</span>
                <span className="cm">{c.meta}</span>
              </div>
            ))}
          </div>
          <div className="teach-col reveal">
            <h4>Research courses</h4>
            {courses.research.map((c) => (
              <div className="course" key={c.name}>
                <span className="cn">{c.name}</span>
                <span className="cm">{c.meta}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="teach-note">{courses.note}</p>
      </div>
    </section>
  );
}
