/** Wait until no native slider is mid-gesture (or timeout). */
export function waitForSlidersIdle(isSliding: () => boolean, maxMs: number): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now();
    const poll = () => {
      if (!isSliding() || Date.now() - start >= maxMs) {
        resolve();
        return;
      }
      requestAnimationFrame(poll);
    };
    poll();
  });
}

export function delayMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Let RNCSlider finish dispatching touch events before changing tree/state. */
export const SLIDER_SETTLE_MS = 150;
export const SLIDER_IDLE_WAIT_MS = 500;
