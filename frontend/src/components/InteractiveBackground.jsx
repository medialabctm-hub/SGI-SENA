import React, { useEffect, useRef } from "react";
import "../styles/interactiveBackground.css";

export default function InteractiveBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const spacing = 26; // Espaciado de la cuadrícula
    const radius = 160; // Radio de influencia del cursor
    const returnSpeed = 0.055; // Velocidad de retorno a posición original
    const pushForce = 6.5; // Fuerza de repulsión
    const friction = 0.88; // Fricción

    let particles = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    }

    function initParticles() {
      particles = [];
      const offsetX = (canvas.width % spacing) / 2;
      const offsetY = (canvas.height % spacing) / 2;

      for (let x = offsetX; x < canvas.width; x += spacing) {
        for (let y = offsetY; y < canvas.height; y += spacing) {
          particles.push({
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

    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    resize();

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      particles.forEach((p) => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // REPULSIÓN: Las partículas se alejan del cursor
        if (dist < radius && dist > 0) {
          const force = (radius - dist) / radius;
          const angle = Math.atan2(dy, dx);

          p.vx += Math.cos(angle) * force * pushForce;
          p.vy += Math.sin(angle) * force * pushForce;
        }

        // Efecto resorte: volver a posición original
        p.vx += (p.x0 - p.x) * returnSpeed;
        p.vy += (p.y0 - p.y) * returnSpeed;

        // Actualizar posición
        p.x += p.vx;
        p.y += p.vy;

        // Aplicar fricción
        p.vx *= friction;
        p.vy *= friction;

        // Calcular color verde basado en distancia al cursor
        let color = "rgba(1, 175, 0, 0.3)"; // Verde base para partículas lejanas

        if (dist < radius * 1.1) {
          const t = Math.max(0, 1 - dist / (radius * 1.1));
          // Verde más intenso cerca del cursor
          const greenValue = Math.floor(100 + t * 75); // De 100 a 175
          const opacity = 0.3 + t * 0.7; // De 0.3 a 1.0
          color = `rgba(1, ${greenValue}, 0, ${opacity})`;
        }

        // Dibujar como DASH (línea) como en Antigravity
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const angle = Math.atan2(p.vy, p.vx);
        
        // Tamaño del dash basado en velocidad y distancia
        const dashLength = dist < radius ? 3 + speed * 0.5 : 2.5;
        const dashWidth = dist < radius ? 1.5 + (1 - dist / radius) * 1 : 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-dashLength / 2, 0);
        ctx.lineTo(dashLength / 2, 0);
        ctx.strokeStyle = color;
        ctx.lineWidth = dashWidth;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="interactive-background-canvas" />;
}
