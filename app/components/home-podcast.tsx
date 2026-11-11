import "capsomer/player.css";
import { formatDate } from "capsomer/behavior/time";
import { Audio } from "capsomer/react/player";
import { clockTime } from "~/lib/podcast/clock.mjs";
import { PODCAST_SITE_URL, type PodcastEpisode } from "~/lib/podcast/feed.mjs";
import { GERMOMICS_X_URL } from "~/lib/seo";

// The episode plays in Capsomer's audio player: native controls, nothing downloaded before play, and its transcript one
// link away. It needs no script.
export function HomePodcast({ episode }: { episode: PodcastEpisode | null }) {
  return (
    <section className="cap-part home-section home-scicomm" aria-labelledby="germomics-heading">
      <h2 id="germomics-heading" className="cap-part-title">
        Germomics
      </h2>
      {episode ? (
        <article className="podcast">
          <h3 className="podcast-title">
            <a href={episode.link}>{episode.title}</a>
          </h3>
          {/* Real separators, not a CSS gap, so reader mode and agents do not get one run-on word. */}
          <p className="podcast-meta">
            {[
              episode.season && episode.episode ? (
                <span key="number">
                  Season {episode.season}, episode {episode.episode}
                </span>
              ) : null,
              <time key="date" dateTime={episode.publishedAt}>
                {formatDate(new Date(episode.publishedAt))}
              </time>,
              episode.durationSeconds ? (
                <span key="length">{clockTime(episode.durationSeconds)}</span>
              ) : null,
            ]
              .filter(Boolean)
              .flatMap((item, i) =>
                i === 0
                  ? [item]
                  : [
                      <span key={`sep-${i}`} className="podcast-sep" aria-hidden="true">
                        {" · "}
                      </span>,
                      item,
                    ],
              )}
          </p>
          {episode.description ? (
            <p className="podcast-description">{episode.description}</p>
          ) : null}
          {/* An audio file owes a text alternative (WCAG 1.2.1): the feed declares the episode's transcript, and the
              episode page holds it, so the player links to it there. An episode with none is not played here. */}
          {episode.transcriptUrl ? (
            <Audio
              src={episode.audioUrl}
              title={episode.title}
              transcript={`${episode.link}#transcript`}
            />
          ) : null}
        </article>
      ) : (
        <p className="home-more">
          The Germomics podcast is at <a href={PODCAST_SITE_URL}>germomics.com</a>.
        </p>
      )}
      <p className="home-more podcast-x">
        <a href={GERMOMICS_X_URL}>Germomics is also on X</a>
      </p>
    </section>
  );
}
