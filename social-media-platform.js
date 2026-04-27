const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  const bars = document.querySelectorAll(".line-chart span");

  setInterval(() => {
    bars.forEach((bar, index) => {
      const nextHeight = 32 + Math.round(Math.abs(Math.sin(Date.now() / 900 + index)) * 58);
      bar.style.setProperty("--h", `${nextHeight}%`);
    });
  }, 900);
}
