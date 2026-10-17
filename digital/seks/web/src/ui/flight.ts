import type { CapturedFlight } from "../board/board3d";
import { dieIcon } from "./svg";

/**
 * A captured die leaves the board for the area "capturado" of its side in the
 * panel. A copy of the die flies over the page from where it was on the
 * board; the area shows the die for good when the match updates.
 */
export function flyToPanel(flight: CapturedFlight, target: HTMLElement | null, duration = 650): Promise<void> {
  if (!target) return Promise.resolve();
  const to = target.getBoundingClientRect();
  if (to.width === 0 && to.height === 0) return Promise.resolve();
  const size = Math.max(8, flight.size);
  const icon = document.createElement("div");
  icon.className = "flying-die";
  icon.innerHTML = dieIcon(flight.value, flight.side, size);
  // The icon has a margin around the die for its shadow: centre the die, not the icon.
  const box = size * 1.25;
  const centre = size / 2 + size * 0.25 * 0.3;
  icon.style.width = icon.style.height = `${box}px`;
  icon.style.left = `${flight.x - centre}px`;
  icon.style.top = `${flight.y - centre}px`;
  document.body.append(icon);

  const slot = 26;
  const toX = to.right - slot / 2 - 4 - flight.x;
  const toY = to.top + to.height / 2 - flight.y;
  const scale = slot / size;
  const animation = icon.animate(
    [
      { transform: "translate(0, 0) scale(1.15)", offset: 0 },
      { transform: `translate(${toX * 0.5}px, ${toY * 0.5 - 24}px) scale(${(1.15 + scale) / 2})`, offset: 0.5 },
      { transform: `translate(${toX}px, ${toY}px) scale(${scale})`, offset: 1 },
    ],
    { duration, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" },
  );
  return animation.finished.then(
    () => {
      requestAnimationFrame(() => icon.remove());
    },
    () => icon.remove(),
  );
}
