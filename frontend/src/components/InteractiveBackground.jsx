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
    const radius = 200; // Radio de influencia del cursor (aumentado)
    const returnSpeed = 0.055; // Velocidad de retorno a posición original
    const pushForce = 8.0; // Fuerza de repulsión (aumentada)
    const friction = 0.88; // Fricción
    const waveSpeed = 0.02; // Velocidad de propagación de la onda
    const waveAmplitude = 15; // Amplitud de la onda

    let particles = [];
    let waveTime = 0; // Tiempo para el efecto de onda

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
      waveTime += waveSpeed;

      particles.forEach((p) => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // EFECTO DE ONDA: Onda sinusoidal que se propaga desde el cursor
        let waveEffect = 0;
        if (dist < radius * 1.5 && dist > 0) {
          // Crear múltiples ondas concéntricas
          const waveDistance = dist / 30; // Frecuencia de la onda
          const wavePhase = waveTime - waveDistance;
          waveEffect = Math.sin(wavePhase) * waveAmplitude * (1 - dist / (radius * 1.5));
        }

        // REPULSIÓN: Las partículas se alejan del cursor
        if (dist < radius && dist > 0) {
          const force = (radius - dist) / radius;
          const angle = Math.atan2(dy, dx);

          // Añadir efecto de onda a la fuerza
          const waveBoost = 1 + Math.abs(waveEffect) / waveAmplitude;
          p.vx += Math.cos(angle) * force * pushForce * waveBoost;
          p.vy += Math.sin(angle) * force * pushForce * waveBoost;
        }

        // Efecto resorte: volver a posición original
        p.vx += (p.x0 - p.x) * returnSpeed;
        p.vy += (p.y0 - p.y) * returnSpeed;

        // Aplicar efecto de onda a la posición (movimiento ondulatorio)
        const waveAngle = Math.atan2(dy, dx) + Math.PI / 2; // Perpendicular a la dirección del cursor
        p.x += Math.cos(waveAngle) * waveEffect * 0.1;
        p.y += Math.sin(waveAngle) * waveEffect * 0.1;

        // Actualizar posición
        p.x += p.vx;
        p.y += p.vy;

        // Aplicar fricción
        p.vx *= friction;
        p.vy *= friction;

        // Calcular color verde basado en distancia al cursor y efecto de onda
        let color = "rgba(1, 175, 0, 0.4)"; // Verde base más visible

        if (dist < radius * 1.2) {
          const t = Math.max(0, 1 - dist / (radius * 1.2));
          // Verde más intenso cerca del cursor
          const greenValue = Math.floor(120 + t * 55); // De 120 a 175
          // Aumentar opacidad con el efecto de onda
          const waveOpacity = Math.abs(waveEffect) / waveAmplitude;
          const opacity = Math.min(1, 0.4 + t * 0.6 + waveOpacity * 0.3);
          color = `rgba(1, ${greenValue}, 0, ${opacity})`;
        }

        // Dibujar como DASH (línea) más grande
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const angle = Math.atan2(p.vy, p.vx);
        
        // Tamaño del dash aumentado y con efecto de onda
        const baseLength = 5; // Tamaño base más grande
        const baseWidth = 2.5; // Ancho base más grande
        const speedBoost = speed * 0.8;
        const waveBoost = 1 + Math.abs(waveEffect) / waveAmplitude * 0.5;
        
        const dashLength = dist < radius 
          ? baseLength + speedBoost + (1 - dist / radius) * 4 * waveBoost
          : baseLength;
        const dashWidth = dist < radius 
          ? baseWidth + (1 - dist / radius) * 2 * waveBoost
          : baseWidth;

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
