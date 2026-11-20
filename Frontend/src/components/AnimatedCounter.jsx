import { useEffect, useState } from "react";
import useInView from "../hooks/useInView";

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function AnimatedCounter({ value, suffix = "", decimals = 0 }) {
  const [ref, isVisible] = useInView();
  const [current, setCurrent] = useState(() => prefersReducedMotion() ? value : 0);

  useEffect(() => {
    if (!isVisible) return undefined;
    if (prefersReducedMotion()) {
      const frameId = requestAnimationFrame(() => setCurrent(value));
      return () => cancelAnimationFrame(frameId);
    }

    const startedAt = performance.now();
    const duration = 1000;
    let frameId;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setCurrent(value * progress);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isVisible, value]);

  return (
    <span ref={ref} aria-label={`${value}${suffix}`}>
      {current.toFixed(decimals)}{suffix}
    </span>
  );
}
