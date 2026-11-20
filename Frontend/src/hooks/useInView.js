import { useEffect, useRef, useState } from "react";

function shouldSkipMotion() {
  return typeof window === "undefined" ||
    !("IntersectionObserver" in window) ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

export default function useInView() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(shouldSkipMotion);

  useEffect(() => {
    if (isVisible || !ref.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible]);

  return [ref, isVisible];
}
