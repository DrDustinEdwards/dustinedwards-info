import askEnhanceUrl from "~/enhance/dist/ask.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * The Ask affordance on /search. Search Layer 2.
 *
 * Server-rendered markup and a script tag, no React island: the button ships
 * HIDDEN with the question in a data attribute, and the prebuilt bundle of
 * app/enhance/ask.ts unhides and binds it. A reader without script never sees
 * an inert control that looks live and does nothing, which is the same rule
 * the palette's "/" hint follows: it stays hidden until something is actually
 * listening. Classic results are already rendered by the loader above this,
 * and nothing here can delay them.
 *
 * search.tsx renders this only when the binding exists and the query is a
 * real question, so the bundle's own empty-question guard is a backstop, not
 * the rule's home.
 */
export function AskMount({ question }: { question: string }) {
  return (
    <div className="ask-mount" data-ask-mount="" data-ask-question={question}>
      <button type="button" className="ask-trigger" data-ask-trigger="" hidden>
        Ask AI about this
      </button>
      <div className="ask-container" data-ask-container="" hidden />
      <EnhancementScript src={askEnhanceUrl} />
    </div>
  );
}
