import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const tags = [
  "#Engineering",
  "#Lund",
  "#NeedAid",
  "#Research",
  "#Travel",
  "#Merit",
  "#Sustainability",
  "#Tuition",
  "#Essay",
  "#STEM"
];

export function Analytics() {
  const tagCloudRef = React.useRef(null);

  React.useEffect(() => {
    const cloud = tagCloudRef.current;
    if (!cloud) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tagNodes = [...cloud.querySelectorAll("span")];
    let frame = 0;
    let resizeTimer = 0;
    let lastTime = performance.now();

    function runPhysics() {
      cancelAnimationFrame(frame);

      const bounds = cloud.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      const wallPadding = 14;
      const floor = height - 28;
      const center = width / 2;
      const stackSlots = [
        { x: -105, y: 0, angle: -6 },
        { x: -25, y: 0, angle: 4 },
        { x: 65, y: 0, angle: -3 },
        { x: -85, y: -48, angle: 6 },
        { x: 0, y: -48, angle: -5 },
        { x: 78, y: -48, angle: 4 },
        { x: -55, y: -96, angle: -4 },
        { x: 50, y: -96, angle: 5 },
        { x: -30, y: -144, angle: -6 },
        { x: 45, y: -144, angle: 4 }
      ];
      const chips = tagNodes.map((node, index) => {
        const chipWidth = node.offsetWidth;
        const chipHeight = node.offsetHeight;
        const radius = Math.max(chipWidth, chipHeight) / 2 + 3;
        const spread = (index - (tagNodes.length - 1) / 2) * (width / tagNodes.length) * 0.82;
        const slot = stackSlots[index % stackSlots.length];
        const slotScale = Math.min(1, width / 360);
        const pileTarget = center + slot.x * slotScale;
        const restAngle = slot.angle;

        return {
          node,
          x: center + spread,
          y: -90 - index * 28,
          vx: (center - (center + spread)) * 0.006 + (index % 2 ? 0.9 : -0.9),
          vy: 0,
          angle: (index % 5 - 2) * 8,
          va: (index % 2 ? 1 : -1) * (0.18 + index * 0.01),
          targetX: pileTarget,
          targetY: floor + slot.y,
          restAngle,
          width: chipWidth,
          height: chipHeight,
          halfWidth: chipWidth / 2 + 7,
          halfHeight: chipHeight / 2 + 7,
          radius,
          delay: index * 85
        };
      });

      if (reduceMotion) {
        chips.forEach((chip, index) => {
          const row = Math.floor(index / 4);
          const col = index % 4;
          chip.x = center - 126 + col * 84 + (row % 2 ? 36 : 0);
          chip.y = floor - row * 48;
          chip.node.style.transform = `translate3d(${chip.x - chip.width / 2}px, ${chip.y - chip.height / 2}px, 0) rotate(${chip.angle}deg)`;
          chip.node.style.opacity = "1";
        });
        return;
      }

      const startTime = performance.now();
      lastTime = startTime;

      function tick(time) {
        const age = time - startTime;
        const elapsed = time - lastTime;
        const dt = Math.min(2, elapsed / 16.67);
        lastTime = time;

        chips.forEach((chip) => {
          chip.active = time - startTime >= chip.delay;
          if (!chip.active) return;

          const pull = (chip.targetX - chip.x) * 0.0012;
          chip.vx += pull * dt;
          chip.vy += 0.72 * dt;
          chip.x += chip.vx * dt;
          chip.y += chip.vy * dt;
          chip.angle += chip.va * dt;
          chip.va *= 0.992;

          if (chip.x - chip.halfWidth < wallPadding) {
            chip.x = wallPadding + chip.halfWidth;
            chip.vx = Math.abs(chip.vx) * 0.58;
            chip.va *= -0.72;
          }

          if (chip.x + chip.halfWidth > width - wallPadding) {
            chip.x = width - wallPadding - chip.halfWidth;
            chip.vx = -Math.abs(chip.vx) * 0.58;
            chip.va *= -0.72;
          }

          if (chip.y + chip.halfHeight > floor) {
            chip.y = floor - chip.halfHeight;
            chip.vy *= -0.32;
            chip.vx *= 0.84;
            chip.va *= 0.62;
          }
        });

        const collisionPasses = age > 5200 ? 22 : 5;
        for (let pass = 0; pass < collisionPasses; pass += 1) {
          for (let i = 0; i < chips.length; i += 1) {
            for (let j = i + 1; j < chips.length; j += 1) {
              const a = chips[i];
              const b = chips[j];
              if (!a.active || !b.active) continue;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const overlapX = a.halfWidth + b.halfWidth - Math.abs(dx);
              const overlapY = a.halfHeight + b.halfHeight - Math.abs(dy);

              if (overlapX > 0 && overlapY > 0) {
                if (overlapX < overlapY) {
                  const direction = Math.sign(dx) || 1;
                  a.x -= direction * overlapX * 0.5;
                  b.x += direction * overlapX * 0.5;
                  const impulse = (a.vx - b.vx) * direction;
                  if (impulse > 0) {
                    a.vx -= impulse * direction * 0.42;
                    b.vx += impulse * direction * 0.42;
                  }
                } else {
                  const direction = Math.sign(dy) || 1;
                  a.y -= direction * overlapY * 0.5;
                  b.y += direction * overlapY * 0.5;
                  const impulse = (a.vy - b.vy) * direction;
                  if (impulse > 0) {
                    a.vy -= impulse * direction * 0.36;
                    b.vy += impulse * direction * 0.36;
                  }
                }
              }
            }
          }
        }

        chips.forEach((chip) => {
          if (!chip.active) return;
          chip.x = Math.max(wallPadding + chip.halfWidth, Math.min(width - wallPadding - chip.halfWidth, chip.x));
          chip.y = Math.min(floor - chip.halfHeight, chip.y);
          if (age > 5200) {
            chip.x += (chip.targetX - chip.x) * 0.18;
            chip.y += (chip.targetY - chip.y) * 0.18;
            chip.vx *= 0.2;
            chip.vy *= 0.2;
            chip.va = 0;
            chip.angle += (chip.restAngle - chip.angle) * 0.16;
          }
        });

        if (age > 5200) {
          for (let pass = 0; pass < 18; pass += 1) {
            for (let i = 0; i < chips.length; i += 1) {
              for (let j = i + 1; j < chips.length; j += 1) {
                const a = chips[i];
                const b = chips[j];
                if (!a.active || !b.active) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const overlapX = a.halfWidth + b.halfWidth - Math.abs(dx);
                const overlapY = a.halfHeight + b.halfHeight - Math.abs(dy);

                if (overlapX > 0 && overlapY > 0) {
                  if (overlapX < overlapY) {
                    const direction = Math.sign(dx) || 1;
                    a.x -= direction * overlapX * 0.5;
                    b.x += direction * overlapX * 0.5;
                  } else {
                    const direction = Math.sign(dy) || 1;
                    a.y -= direction * overlapY * 0.5;
                    b.y += direction * overlapY * 0.5;
                  }
                }
              }
            }

            chips.forEach((chip) => {
              chip.x = Math.max(wallPadding + chip.halfWidth, Math.min(width - wallPadding - chip.halfWidth, chip.x));
              chip.y = Math.min(floor - chip.halfHeight, chip.y);
            });
          }
        }

        chips.forEach((chip) => {
          if (!chip.active) return;
          chip.node.style.transform = `translate3d(${chip.x - chip.width / 2}px, ${chip.y - chip.height / 2}px, 0) rotate(${chip.angle}deg)`;
          chip.node.style.opacity = "1";
        });

        if (age < 6400) frame = requestAnimationFrame(tick);
      }

      frame = requestAnimationFrame(tick);
    }

    runPhysics();
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(runPhysics, 180);
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return e(
    "section",
    { id: "analytics", className: "relative bg-white px-4 pb-16 pt-16 sm:px-10 sm:pb-24 sm:pt-24 lg:px-20" },
    e(
      "div",
      { className: "mx-auto max-w-[1320px]" },
      e("h2", { className: "mx-auto max-w-2xl text-center text-[clamp(2.15rem,11vw,5rem)] font-medium leading-[1.04] tracking-normal sm:text-[clamp(2.6rem,5vw,5rem)]" }, "Advanced Matching and Reporting"),
      e(
        "div",
        { className: "mt-10 grid gap-5 sm:mt-16 sm:gap-6 lg:grid-cols-[0.85fr_1.15fr]" },
        e(
          "article",
          { className: "analytics-card" },
            e("h3", { className: "text-[clamp(1.45rem,6vw,2.25rem)] font-medium tracking-normal" }, "Scholarship Fit Signals"),
            e(
              "div",
              { className: "mt-5 rounded-[8px] bg-white p-4 shadow-inner sm:mt-7 sm:p-6" },
              e(
                "div",
                { className: "tag-cloud min-h-[285px]", ref: tagCloudRef },
              tags.map((tag) =>
                e(
                  "span",
                  {
                    key: tag
                  },
                  tag
                )
              )
            )
          ),
          e(
            "div",
            { className: "mt-5 grid grid-cols-3 gap-3" },
            e("span", { className: "h-2 rounded-full bg-purple" }),
            e("span", { className: "h-2 rounded-full bg-pink" }),
            e("span", { className: "h-2 rounded-full bg-yellow" })
          )
        ),
        e(
          "article",
          { className: "analytics-card" },
          e("h3", { className: "text-[clamp(1.45rem,6vw,2.25rem)] font-medium tracking-normal" }, "Optimizing Applications"),
          e(
            "div",
            { className: "mt-5 grid gap-5 sm:mt-7 sm:gap-6 lg:grid-cols-[190px_1fr]" },
            e(
              "div",
              { className: "grid gap-5" },
              e("div", { className: "metric-tile bg-yellow" }, e("span", null, "Match Rate"), e("strong", null, "+61%")),
              e("div", { className: "metric-tile bg-pink text-white" }, e("span", null, "Completed Steps"), e("strong", null, "+73%"))
            ),
            e(
              "div",
              { className: "relative min-h-[250px] rounded-[8px] bg-white p-4 sm:min-h-[310px] sm:p-6" },
              e(
                "div",
                { className: "mb-7 flex flex-wrap justify-center gap-2 rounded-full border border-black/80 px-2 py-1 text-[11px]" },
                ["3 days", "1 week", "1 month", "3 months", "6 months", "1 year"].map((tab) =>
                  e("span", { key: tab, className: tab === "1 week" ? "rounded-full bg-black px-3 py-1 text-white" : "px-3 py-1" }, tab)
                )
              ),
              e(
                "svg",
                { viewBox: "0 0 580 260", className: "h-auto w-full overflow-visible" },
                e("path", { className: "chart-grid", d: "M0 52H580M0 116H580M0 180H580" }),
                e("path", { className: "chart-line chart-faint", d: "M26 210 C92 122 132 132 186 158 C254 192 286 218 346 176 C412 128 455 126 552 40" }),
                e("path", { className: "chart-line chart-hot", d: "M26 210 C92 122 132 132 186 158 C254 192 286 218 346 176 C412 128 455 126 552 40" }),
                e("line", { className: "chart-marker", x1: "186", x2: "186", y1: "158", y2: "236" }),
                e("line", { className: "chart-marker", x1: "430", x2: "430", y1: "138", y2: "236" }),
                e("circle", { className: "chart-dot", cx: "186", cy: "158", r: "8" }),
                e("circle", { className: "chart-dot", cx: "430", cy: "138", r: "8" }),
                e("text", { className: "chart-label", x: "128", y: "121" }, "+49%"),
                e("text", { className: "chart-label", x: "386", y: "102" }, "+70%")
              )
            )
          )
        )
      )
    )
  );
}
