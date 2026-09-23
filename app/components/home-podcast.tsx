import podcastEnhanceUrl from "~/enhance/dist/podcast.js?url";

import { EnhancementScript } from "~/components/enhancement-script";
import { longDateUTC } from "~/lib/long-date.mjs";
import { PODCAST_SITE_URL, clockTime, type PodcastEpisode } from "~/lib/podcast/feed.mjs";

const X_URL = "https://x.com/Germomics";

/**
 * SCIENCE COMMUNICATION (ruling 134): one Germomics episode, laid out the way germomics.com lays out
 * an episode page (title, a line of date and length, the description, then the player) and redrawn
 * in Paper and Plate. No eyebrow above the title, which this direction refuses; the show's name
 * leads the meta line instead.
 *
 * COMPLETE WITHOUT SCRIPT. The audio element carries native controls and plays as it is. The
 * hand-drawn controls are server markup marked `hidden`, and `app/enhance/podcast.ts` swaps them in,
 * so a reader without script never meets a button that does nothing. No third-party player.
 */
export function HomePodcast({ episode }: { episode: PodcastEpisode | null }) {
  return (
    <section className="home-section home-scicomm" aria-labelledby="scicomm-heading">
      <h2 id="scicomm-heading" className="home-section-heading">
        Science communication
      </h2>
      {episode ? (
        <article className="podcast" data-podcast>
          <h3 className="podcast-title">
            <a href={episode.link}>{episode.title}</a>
          </h3>
          {/* Real separators, not a CSS gap, so reader mode and agents do not get one run-on word. */}
          <p className="podcast-meta">
            {[
              <span key="show">Germomics</span>,
              episode.season && episode.episode ? (
                <span key="number">
                  Season {episode.season}, episode {episode.episode}
                </span>
              ) : null,
              <time key="date" dateTime={episode.publishedAt}>
                {longDateUTC(new Date(episode.publishedAt))}
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
          {episode.description ? <p className="podcast-description">{episode.description}</p> : null}
          <div className="podcast-player">
            <audio
              className="podcast-audio"
              controls
              preload="none"
              src={episode.audioUrl}
              aria-label={`Play ${episode.title}`}
            >
              <a href={episode.audioUrl}>Download the episode</a>
            </audio>
            <div className="podcast-controls" data-podcast-controls hidden>
              <div className="podcast-scrub">
                <span className="podcast-time" data-podcast-elapsed>
                  0:00
                </span>
                <input
                  className="podcast-range"
                  type="range"
                  min={0}
                  max={episode.durationSeconds ?? 0}
                  step={1}
                  defaultValue={0}
                  aria-label="Seek"
                  data-podcast-seek
                />
                <span className="podcast-time" data-podcast-total>
                  {episode.durationSeconds ? clockTime(episode.durationSeconds) : "--:--"}
                </span>
              </div>
              <div className="podcast-buttons">
                <button type="button" className="podcast-btn" data-podcast-play>
                  Play
                </button>
                <button type="button" className="podcast-btn" data-podcast-skip="-15">
                  Back 15 s
                </button>
                <button type="button" className="podcast-btn" data-podcast-skip="30">
                  Forward 30 s
                </button>
              </div>
            </div>
          </div>
          <p className="home-more podcast-links">
            <a href={episode.link}>Episode page</a>
            <a href={PODCAST_SITE_URL}>germomics.com</a>
          </p>
          <EnhancementScript src={podcastEnhanceUrl} />
        </article>
      ) : (
        <p className="home-more">
          The Germomics podcast is at <a href={PODCAST_SITE_URL}>germomics.com</a>.
        </p>
      )}
      <p className="home-more podcast-x">
        <a href={X_URL}>Germomics is also on X</a>
      </p>
    </section>
  );
}
