import React, { useEffect, useRef } from "react";
import "../styles/interactiveBackground.css";

export default function InteractiveDotsBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const spacing = 26; // separación EXACTA como en Antigravity
    const radius = 160; // radio de deformación real
    const returnSpeed = 0.055; // fuerza resorte original
    const pushForce = 6.5; // fuerza de empuje idéntica
    const friction = 0.88; // fricción para suavidad

    let dots = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDots();
    }

    window.addEventListener("resize", resize);
    resize();

    /** CREA LA CUADRÍCULA EXACTA DE ANTIGRAVITY */
    function initDots() {
      dots = [];
      const offsetX = (canvas.width % spacing) / 2;
      const offsetY = (canvas.height % spacing) / 2;

      for (let x = offsetX; x < canvas.width; x += spacing) {
        for (let y = offsetY; y < canvas.height; y += spacing) {
          dots.push({
            x0: x,
            y0: y,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
          });
        }
      }
    }

    /** MOVIMIENTO DEL USUARIO */
    const mouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
        active: true,
      };
    };

    window.addEventListener("mousemove", mouseMove);

    /** ANIMACIÓN PRINCIPAL */
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      dots.forEach((p) => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 🔵 FUERZA QUE REPELE COMO ANTIGRAVITY
        if (mouse.active && dist < radius) {
          const force = (radius - dist) / radius;
          const angle = Math.atan2(dy, dx);

          p.vx += Math.cos(angle) * force * pushForce;
          p.vy += Math.sin(angle) * force * pushForce;
        }

        // 🔵 EFECTO RESORTE — VOLVER A POSICIÓN ORIGINAL
        p.vx += (p.x0 - p.x) * returnSpeed;
        p.vy += (p.y0 - p.y) * returnSpeed;

        // movimiento final
        p.x += p.vx;
        p.y += p.vy;

        p.vx *= friction;
        p.vy *= friction;

        // 🔵 COLOR REAL EXACTO DE ANTIGRAVITY
        let color = "rgba(0, 0, 0, 0.55)"; // puntos grises externos

        if (dist < radius * 1.1) {
          const t = Math.max(0, 1 - dist / (radius * 1.1));
          const blueLevel = Math.floor(255 * t);
          const opacity = 0.25 + t * 0.55;

          color = `rgba(${40 - t * 40}, ${110 - t * 110}, ${255}, ${opacity})`;
        }

        // 🔵 TAMAÑO REAL (crece cerca del cursor)
        const size = dist < radius ? 2.6 + (1 - dist / radius) * 2.1 : 2;

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", mouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="interactive-background-canvas" />;
}
