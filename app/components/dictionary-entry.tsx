import { Enhance } from "~/components/enhance";
import { listenLabel, type DictionaryEntry as Entry } from "~/lib/dictionary-entries.mjs";

import "~/styles/dictionary-entry.css";

/** A speaker with two sound waves; the waves carry the playing state in CSS. */
function SpeakerIcon() {
  return (
    <svg className="term-speaker" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path className="term-wave term-wave-1" d="M15 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path className="term-wave term-wave-2" d="M17.6 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The dictionary entry that opens a named software page. Without script the speaker is a plain link
 * to the clip, which any browser plays; app/enhance/pronounce.ts swaps it for the button, which plays
 * in place. Nothing plays until the reader asks: no autoplay, and the clip is not fetched before then.
 */
export function DictionaryEntry({ entry }: { entry: Entry }) {
  const label = listenLabel(entry.term);
  return (
    <section className="term-entry" aria-label={`Dictionary entry: ${entry.term}`} data-term-entry>
      <p className="term-head">
        <dfn className="term-word">
          <span className="sr-only">{entry.term.toLowerCase()}</span>
          <span aria-hidden="true">{entry.syllables}</span>
        </dfn>
        <span className="term-pron">
          <span className="term-ipa">{entry.ipa}</span>
          <span className="term-respell">{entry.respelling}</span>
          {/* Inside the pronunciation, so on a narrow screen the speaker wraps with it, never alone. */}
          <a className="term-listen term-listen-link" href={entry.audio} data-term-audio-link aria-label={label}>
            <SpeakerIcon />
          </a>
          <button
            type="button"
            className="term-listen"
            data-term-listen={entry.audio}
            aria-label={label}
            aria-pressed="false"
            hidden
          >
            <SpeakerIcon />
          </button>
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
        {entry.senses.map((sense) => (
          <li key={sense.slice(0, 24)}>{sense}</li>
        ))}
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
      <Enhance module="pronounce" />
    </section>
  );
}
