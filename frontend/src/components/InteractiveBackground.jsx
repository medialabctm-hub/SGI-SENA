import React, { useEffect, useRef } from "react";
import "../styles/interactiveBackground.css";

export default function InteractiveBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const spacing = 26; // separación entre puntos
    const radius = 200; // radio de atracción hacia el cursor
    const returnSpeed = 0.055; // fuerza resorte para volver a posición original
    const attractionForce = 4.5; // fuerza de atracción hacia el cursor
    const friction = 0.88; // fricción para suavidad

    let dots = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDots();
    }

    window.addEventListener("resize", resize);
    // Inicializar inmediatamente
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
        const dx = mouse.x - p.x; // Invertido para atracción
        const dy = mouse.y - p.y; // Invertido para atracción
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 🟢 FUERZA QUE ATRAE HACIA EL CURSOR
        if (mouse.active && dist < radius && dist > 0) {
          const force = (radius - dist) / radius;
          const angle = Math.atan2(dy, dx);

          // Atraer hacia el cursor
          p.vx += Math.cos(angle) * force * attractionForce;
          p.vy += Math.sin(angle) * force * attractionForce;
        }

        // 🟢 EFECTO RESORTE — VOLVER A POSICIÓN ORIGINAL
        p.vx += (p.x0 - p.x) * returnSpeed;
        p.vy += (p.y0 - p.y) * returnSpeed;

        // movimiento final
        p.x += p.vx;
        p.y += p.vy;

        p.vx *= friction;
        p.vy *= friction;

        // 🟢 COLORES VERDES - más intenso cerca del cursor
        let color = "rgba(1, 175, 0, 0.4)"; // verde base para puntos lejanos

        if (dist < radius * 1.2) {
          const t = Math.max(0, 1 - dist / (radius * 1.2));
          // Verde más intenso y brillante cerca del cursor
          const greenIntensity = Math.floor(1 + t * 174); // de 1 a 175
          const opacity = 0.4 + t * 0.6; // de 0.4 a 1.0

          color = `rgba(1, ${greenIntensity}, 0, ${opacity})`;
        }

        // 🟢 TAMAÑO (crece cerca del cursor)
        const size = dist < radius ? 2 + (1 - dist / radius) * 2.5 : 2;

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
