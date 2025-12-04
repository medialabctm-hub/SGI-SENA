import React, { useEffect, useRef } from 'react';
import '../styles/interactiveBackground.css';

/**
 * Fondo interactivo estilo Google Antigravity:
 * - partículas más rápidas
 * - estelas tipo dash
 * - conexiones suaves
 * - repulsión elástica
 */
export default function InteractiveBackground() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const particleCount = 240;
    const particleSize = 1.7;
    const repulsionRadius = 180;
    const repulsionStrength = 0.08; // Mucho más suave = estilo Antigravity
    const connectionDistance = 170;
    const globalFloatStrength = 0.02; // fuerza de flotación global

    // Ajuste de tamaño
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Crear partículas
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8, // Más rápido
      vy: (Math.random() - 0.5) * 0.8,
      size: particleSize + Math.random() * 0.8,
      opacity: Math.random() * 0.5 + 0.3,
    }));

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      particles.forEach((p, i) => {
        // Repulsión estilo Antigravity
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < repulsionRadius && dist > 0) {
          // fuerza elástica suave
          const force = (repulsionRadius - dist) / repulsionRadius;
          const angle = Math.atan2(dy, dx);

          p.vx += Math.cos(angle) * force * repulsionStrength;
          p.vy += Math.sin(angle) * force * repulsionStrength;

          p.opacity = Math.min(1, 0.25 + force);
        } else {
          p.opacity *= 0.98;
        }

        // Flotación global suave
        p.vx += (Math.random() - 0.5) * globalFloatStrength;
        p.vy += (Math.random() - 0.5) * globalFloatStrength;

        // Movimiento
        p.x += p.vx;
        p.y += p.vy;

        // rebote suave
        if (p.x < 0 || p.x > canvas.width) p.vx *= -0.9;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -0.9;

        // fricción
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Limitar velocidad (más alta como Antigravity)
        const maxSpeed = 3.2;
        const speed = Math.sqrt(p.vx ** 2 + p.vy ** 2);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        // Dibujo tipo Antigravity: líneas con orientación a la velocidad
        ctx.save();
        ctx.translate(p.x, p.y);
        const angle = Math.atan2(p.vy, p.vx);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-p.size * 2.5, 0);
        ctx.lineTo(p.size * 2.5, 0);
        ctx.strokeStyle = `rgba(1, 175, 0, ${p.opacity})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();

        // Conexiones tipo malla suave
        particles.slice(i + 1).forEach((o) => {
          const dx2 = o.x - p.x;
          const dy2 = o.y - p.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < connectionDistance) {
            const opacity = (1 - dist2 / connectionDistance) * 0.18 * Math.min(p.opacity, o.opacity);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(o.x, o.y);
            ctx.strokeStyle = `rgba(1, 175, 0, ${opacity})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="interactive-background-canvas" />;
}
