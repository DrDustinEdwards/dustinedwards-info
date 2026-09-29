// The pronunciation button on a dictionary entry (app/components/dictionary-entry.tsx). The server
// renders a plain link to the clip, which works with script off; this swaps in the real button, which
// plays the clip in place on click, Enter or Space (a native <button> gives all three). Nothing plays
// until asked, and the clip is fetched on the first press, not before. aria-pressed carries the state
// while it plays; a second press stops it.

for (const root of document.querySelectorAll<HTMLElement>("[data-term-entry]")) {
  const button = root.querySelector<HTMLButtonElement>("[data-term-listen]");
  const link = root.querySelector<HTMLAnchorElement>("[data-term-audio-link]");
  const src = button?.dataset.termListen;
  if (!button || !link || !src) continue;

  let audio: HTMLAudioElement | null = null;

  const paint = (playing: boolean) => {
    button.setAttribute("aria-pressed", String(playing));
    button.classList.toggle("is-playing", playing);
  };

  const clip = () => {
    if (audio) return audio;
    const created = new Audio();
    created.preload = "none";
    created.src = src;
    created.addEventListener("play", () => paint(true));
    created.addEventListener("pause", () => paint(false));
    created.addEventListener("ended", () => paint(false));
    // A clip that cannot load brings the plain link back, so the reader still has a way to hear it.
    created.addEventListener("error", () => {
      paint(false);
      button.hidden = true;
      link.hidden = false;
    });
    audio = created;
    return created;
  };

  button.addEventListener("click", () => {
    const player = clip();
    if (!player.paused) {
      player.pause();
      player.currentTime = 0;
      return;
    }
    player.currentTime = 0;
    player.play().catch((error: unknown) => {
      paint(false);
      // A second press while the first play was still starting: the reader stopped it, nothing failed.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // A refused play is reported, not swallowed; the link stays one press away.
      button.hidden = true;
      link.hidden = false;
      throw error;
    });
  });

  link.hidden = true;
  button.hidden = false;
}
