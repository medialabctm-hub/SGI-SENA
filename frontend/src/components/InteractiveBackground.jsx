import React, { useEffect, useRef } from "react";
import "../styles/interactiveBackground.css";

export default function InteractiveBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const animationRef = useRef(null);
  const waveTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const spacing = 26; // Espaciado de la cuadrícula
    const radius = 300; // Radio de influencia más grande
    const returnSpeed = 0.055; // Velocidad de retorno a posición original
    const pushForce = 8.0; // Fuerza de repulsión aumentada
    const friction = 0.88; // Fricción
    const waveSpeed = 0.05; // Velocidad de propagación de la onda
    const waveAmplitude = 20; // Amplitud de la onda

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
      
      // Incrementar tiempo para el efecto de onda
      waveTimeRef.current += waveSpeed;

      particles.forEach((p) => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // EFECTO DE ONDA: Onda sinusoidal que se propaga desde el cursor
        let waveEffect = 0;
        if (dist < radius * 1.5 && dist > 0) {
          const waveDistance = dist / 40; // Frecuencia de la onda
          const wavePhase = waveTimeRef.current - waveDistance;
          waveEffect = Math.sin(wavePhase) * waveAmplitude * (1 - dist / (radius * 1.5));
        }

        // REPULSIÓN: Las partículas se alejan del cursor
        if (dist < radius && dist > 0) {
          const force = (radius - dist) / radius;
          const angle = Math.atan2(dy, dx);

          // Añadir efecto de onda a la fuerza
          const waveBoost = 1 + Math.abs(waveEffect) / waveAmplitude * 0.3;
          p.vx += Math.cos(angle) * force * pushForce * waveBoost;
          p.vy += Math.sin(angle) * force * pushForce * waveBoost;
        }

        // Efecto resorte: volver a posición original
        p.vx += (p.x0 - p.x) * returnSpeed;
        p.vy += (p.y0 - p.y) * returnSpeed;

        // Aplicar efecto de onda a la posición (movimiento ondulatorio)
        if (dist < radius * 1.5) {
          const waveAngle = Math.atan2(dy, dx) + Math.PI / 2; // Perpendicular
          p.x += Math.cos(waveAngle) * waveEffect * 0.15;
          p.y += Math.sin(waveAngle) * waveEffect * 0.15;
        }

        // Actualizar posición
        p.x += p.vx;
        p.y += p.vy;

        // Aplicar fricción
        p.vx *= friction;
        p.vy *= friction;

        // Determinar si la partícula está activa (cerca del cursor)
        const isActive = dist < radius * 1.2;

        // COLOR: Negro si está inactiva, verde si está activa
        let color = "rgba(0, 0, 0, 0.4)"; // Negro para partículas inactivas

        if (isActive) {
          const t = Math.max(0, 1 - dist / (radius * 1.2));
          // Verde más intenso cerca del cursor
          const greenValue = Math.floor(100 + t * 75); // De 100 a 175
          const opacity = 0.5 + t * 0.5; // De 0.5 a 1.0
          color = `rgba(1, ${greenValue}, 0, ${opacity})`;
        }

        // GRADIENTE DE TAMAÑO según distancia al cursor
        // 5 niveles: grande, semi grande, mediano, semi mediano, pequeño
        let size;
        if (dist < radius * 0.2) {
          // Grande (muy cerca)
          size = 4.5;
        } else if (dist < radius * 0.4) {
          // Semi grande
          size = 3.5;
        } else if (dist < radius * 0.6) {
          // Mediano
          size = 2.8;
        } else if (dist < radius * 0.8) {
          // Semi mediano
          size = 2.2;
        } else if (dist < radius) {
          // Pequeño (pero aún activo)
          size = 1.8;
        } else {
          // Muy pequeño para inactivas
          size = 1.2;
        }

        // Dibujar como punto circular (SIN rotación)
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
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="interactive-background-canvas" />;
}
