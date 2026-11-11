import { listenLabel, type DictionaryEntry as Entry } from "~/lib/dictionary-entries.mjs";

import { PlayClip } from "capsomer/react/player";

import "capsomer/player.css";
import "~/styles/dictionary-entry.css";

/**
 * The dictionary entry that opens a named software page. The speaker is Capsomer's PlayClip: without
 * script a plain link to the clip, which any browser plays; the "pronounce" island runs Capsomer's player
 * behavior, which swaps in the button that plays in place. Nothing plays until the reader asks: no
 * autoplay, and the clip is not fetched before then.
 */
export function DictionaryEntry({ entry }: { entry: Entry }) {
  const label = listenLabel(entry.term);
  return (
    <section className="term-entry" aria-label={`Dictionary entry: ${entry.term}`}>
      <p className="term-head">
        <dfn className="term-word">
          <span className="sr-only">{entry.term.toLowerCase()}</span>
          <span aria-hidden="true">{entry.syllables}</span>
        </dfn>
        <span className="term-pron">
          <span className="term-ipa">{entry.ipa}</span>
          <span className="term-respell">{entry.respelling}</span>
          {/* Inside the pronunciation, so on a narrow screen the speaker wraps with it, never alone. */}
          <PlayClip src={entry.audio} label={label} />
        </span>
      </p>
      <p className="term-pos">
        <i>{entry.partOfSpeech}</i>
        {entry.plural ? (
          <>
            ; plural{" "}
            {entry.plural.map((form, i) => (
              <span key={form}>
                {i > 0 ? " or " : null}
                <i>{form}</i>
              </span>
            ))}
          </>
        ) : null}
      </p>
      <ol className="term-senses">
        {entry.senses.map((sense, i) => {
          const label = entry.senseLabels[i];
          return (
            <li key={sense.slice(0, 24)}>
              {label ? (
                <>
                  <i className="term-label">{label}.</i>{" "}
                </>
              ) : null}
              {sense}
            </li>
          );
        })}
      </ol>
      <p className="term-ety">
        <span className="term-ety-label">Etymology</span>{" "}
        {entry.etymology.map((part, i) =>
          typeof part === "string" ? (
            <span key={i}>{part}</span>
          ) : (
            <i key={i} lang={part[0]}>
              {part[1]}
            </i>
          ),
        )}
      </p>
      <template data-island="pronounce" />
    </section>
  );
}
