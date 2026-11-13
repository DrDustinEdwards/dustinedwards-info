// The button ships hidden and the bundle unhides it, so a reader without script
// never sees an inert control that looks live.
export function AskMount({ question }: { question: string }) {
  return (
    <div className="ask-mount" data-cap="ask" data-ask-question={question}>
      <button type="button" className="cap-btn" data-size="sm" data-ask-trigger="" hidden>
        Ask AI about this
      </button>
      <div data-ask-container="" hidden />
      <template data-island="ask" />
    </div>
  );
}
