import { Enhance } from "~/components/enhance";

// The button ships hidden and the bundle unhides it, so a reader without script
// never sees an inert control that looks live.
export function AskMount({ question }: { question: string }) {
  return (
    <div className="ask-mount" data-ask-mount="" data-ask-question={question}>
      <button type="button" className="ask-trigger" data-ask-trigger="" hidden>
        Ask AI about this
      </button>
      <div className="ask-container" data-ask-container="" hidden />
      <Enhance module="ask" />
    </div>
  );
}
