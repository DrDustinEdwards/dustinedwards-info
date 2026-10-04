// A cross-document view transition (motion-print.css, type `site`) the browser abandons rejects its promises with
// `InvalidStateError: Transition was aborted because of invalid state`: the page was reloaded, went hidden or was
// navigated again while the transition was still running. Nothing in the page caused it and nothing in the page can
// handle it, since the promise belongs to the browser's own navigation. It is the one error the page lets go: every
// other rejection, including any other InvalidStateError, is still reported.

/**
 * Whether a rejection is the browser abandoning a view transition.
 *
 * @param {unknown} reason
 */
export function isAbandonedTransition(reason) {
  return reason instanceof DOMException && reason.name === "InvalidStateError" && reason.message.startsWith("Transition was aborted");
}
