import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type CSSProperties } from "react";

const dustParticles = Array.from({ length: 24 }, (_, index) => ({
  left: `${(index * 37 + 9) % 101}%`,
  top: `${(index * 53 + 17) % 96}%`,
  size: `${1 + (index % 3) * 0.7}px`,
  delay: `${-((index * 0.83) % 11).toFixed(2)}s`,
  duration: `${9 + (index % 7) * 1.7}s`,
  drift: `${(index % 2 === 0 ? 1 : -1) * (18 + (index % 5) * 7)}px`,
}));

type DustStyle = CSSProperties & {
  "--dust-size": string;
  "--dust-delay": string;
  "--dust-duration": string;
  "--dust-drift": string;
};

export function LobbyAtmosphere() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const root = document.querySelector<HTMLElement>(".lobby");
    if (!root) return;

    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      root.style.setProperty("--lobby-scene-x", `${(currentX * -10).toFixed(2)}px`);
      root.style.setProperty("--lobby-scene-y", `${(currentY * -6).toFixed(2)}px`);
      root.style.setProperty("--lobby-light-x", `${(currentX * 18).toFixed(2)}px`);
      root.style.setProperty("--lobby-light-y", `${(currentY * 12).toFixed(2)}px`);

      if (
        Math.abs(targetX - currentX) > 0.002 ||
        Math.abs(targetY - currentY) > 0.002
      ) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      targetX = event.clientX / window.innerWidth - 0.5;
      targetY = event.clientY / window.innerHeight - 0.5;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--lobby-scene-x");
      root.style.removeProperty("--lobby-scene-y");
      root.style.removeProperty("--lobby-light-x");
      root.style.removeProperty("--lobby-light-y");
    };
  }, [reduceMotion]);

  return (
    <div className="lobby-cinematic" aria-hidden="true">
      <div className="lobby-scene-motion" />
      <div className="lobby-owl-presence" />
      <div className="lobby-light-beam lobby-light-beam-left" />
      <div className="lobby-light-beam lobby-light-beam-center" />
      <div className="lobby-gold-haze" />
      <div className="lobby-dust-field">
        {dustParticles.map((particle, index) => (
          <i
            key={index}
            style={
              {
                left: particle.left,
                top: particle.top,
                "--dust-size": particle.size,
                "--dust-delay": particle.delay,
                "--dust-duration": particle.duration,
                "--dust-drift": particle.drift,
              } as DustStyle
            }
          />
        ))}
      </div>
      <div className="lobby-film-vignette" />
    </div>
  );
}

export function LobbyDoorTransition({ label }: { label: string | null }) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0.01 : 0.52;

  return (
    <AnimatePresence>
      {label && (
        <motion.div
          className="lobby-passage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.16 }}
          aria-hidden="true"
        >
          <motion.div
            className="lobby-passage-door lobby-passage-door-left"
            initial={{ x: "-102%" }}
            animate={{ x: 0 }}
            transition={{ duration, ease: [0.72, 0, 0.18, 1] }}
          />
          <motion.div
            className="lobby-passage-door lobby-passage-door-right"
            initial={{ x: "102%" }}
            animate={{ x: 0 }}
            transition={{ duration, ease: [0.72, 0, 0.18, 1] }}
          />
          <motion.div
            className="lobby-passage-seal"
            initial={{ opacity: 0, scale: 0.72, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              delay: reduceMotion ? 0 : 0.28,
              duration: reduceMotion ? 0.01 : 0.3,
              ease: [0.18, 0.88, 0.3, 1.2],
            }}
          >
            <span>MP</span>
            <small>{label}</small>
          </motion.div>
          <motion.i
            className="lobby-passage-line"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{
              delay: reduceMotion ? 0 : 0.2,
              duration: reduceMotion ? 0.01 : 0.34,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
