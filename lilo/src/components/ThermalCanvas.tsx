import { useEffect, useRef } from "react";

/**
 * Animierter "Thermo-Cam"-Hintergrund: driftende, weiche Farbzonen in den
 * Markenfarben – wie thermische Visualisierungen / pulsierende Hitzezonen
 * (Konzept Route 1, S. 18). Leichtgewichtig via Canvas + requestAnimationFrame.
 */

type Blob = {
  x: number;
  y: number;
  r: number;
  hue: string;
  dx: number;
  dy: number;
  phase: number;
};

const COLORS = ["#742df7", "#7947e8", "#3a9a38", "#44f72d"];

export default function ThermalCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const blobs: Blob[] = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.28 + Math.random() * 0.22,
      hue: COLORS[i % COLORS.length],
      dx: (Math.random() - 0.5) * 0.00018,
      dy: (Math.random() - 0.5) * 0.00018,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        if (!reduce) {
          b.x += b.dx;
          b.y += b.dy;
          if (b.x < -0.2 || b.x > 1.2) b.dx *= -1;
          if (b.y < -0.2 || b.y > 1.2) b.dy *= -1;
        }
        const pulse = reduce ? 1 : 0.85 + Math.sin(t * 0.0006 + b.phase) * 0.15;
        const cx = b.x * w;
        const cy = b.y * h;
        const radius = b.r * Math.max(w, h) * pulse;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, b.hue + "cc");
        g.addColorStop(0.45, b.hue + "44");
        g.addColorStop(1, b.hue + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    if (reduce) draw(0);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
