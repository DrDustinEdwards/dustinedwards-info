import { clockTime } from "~/lib/podcast/clock.mjs";

for (const root of document.querySelectorAll<HTMLElement>("[data-podcast]")) {
  const audio = root.querySelector<HTMLAudioElement>(".podcast-audio");
  const controls = root.querySelector<HTMLElement>("[data-podcast-controls]");
  const play = root.querySelector<HTMLButtonElement>("[data-podcast-play]");
  const seek = root.querySelector<HTMLInputElement>("[data-podcast-seek]");
  const elapsed = root.querySelector<HTMLElement>("[data-podcast-elapsed]");
  const total = root.querySelector<HTMLElement>("[data-podcast-total]");
  if (!audio || !controls || !play || !seek || !elapsed || !total) continue;

  const duration = () =>
    Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(seek.max) || 0;

  let dragging = false;

  const paint = () => {
    const now = audio.currentTime;
    if (!dragging) seek.value = String(Math.floor(now));
    elapsed.textContent = clockTime(dragging ? Number(seek.value) : now);
    seek.setAttribute(
      "aria-valuetext",
      `${clockTime(dragging ? Number(seek.value) : now)} of ${clockTime(duration())}`,
    );
  };

  const paintButton = () => {
    play.textContent = audio.paused ? "Play" : "Pause";
  };

  /** A seek before the metadata has loaded is held and applied once it has. */
  const seekTo = (seconds: number) => {
    const target = Math.min(Math.max(0, seconds), duration() || seconds);
    if (audio.readyState >= 1) {
      audio.currentTime = target;
    } else {
      audio.addEventListener("loadedmetadata", () => (audio.currentTime = target), { once: true });
      audio.load();
    }
    seek.value = String(Math.floor(target));
    paint();
  };

  audio.controls = false;
  controls.hidden = false;
  paint();

  play.addEventListener("click", () => {
    if (audio.paused) void audio.play().catch(() => paintButton());
    else audio.pause();
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-podcast-skip]")) {
    const delta = Number(button.dataset.podcastSkip);
    button.addEventListener("click", () => seekTo(audio.currentTime + delta));
  }

  seek.addEventListener("input", () => {
    dragging = true;
    paint();
  });
  seek.addEventListener("change", () => {
    dragging = false;
    seekTo(Number(seek.value));
  });

  audio.addEventListener("loadedmetadata", () => {
    seek.max = String(Math.floor(duration()));
    total.textContent = clockTime(duration());
    paint();
  });
  audio.addEventListener("timeupdate", paint);
  audio.addEventListener("play", paintButton);
  audio.addEventListener("pause", paintButton);
  audio.addEventListener("ended", paintButton);
  audio.addEventListener("error", () => {
    controls.hidden = true;
    audio.controls = true;
  });
}
