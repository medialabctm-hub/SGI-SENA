import React, { useEffect, useRef } from 'react';
import '../styles/interactiveBackground.css';

/**
 * Componente de fondo interactivo similar a Google Antigravity
 * Partículas que se alejan del mouse creando un efecto de "liftoff"
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
    const particleCount = 250;
    const particleSize = 2;
    const connectionDistance = 150;
    const repulsionStrength = 0.2;

    // Ajustar tamaño del canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Crear partículas con distribución inicial
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: particleSize + Math.random() * 1,
      opacity: Math.random() * 0.5 + 0.2,
      baseOpacity: Math.random() * 0.5 + 0.2,
    }));

    // Seguir el mouse
    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Función de animación
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Actualizar y dibujar partículas
      particles.forEach((particle, i) => {
        // Repulsión desde el mouse (efecto "liftoff")
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 300 && distance > 0) {
          const force = (300 - distance) / 300;
          const angle = Math.atan2(dy, dx);
          particle.vx += Math.cos(angle) * force * repulsionStrength;
          particle.vy += Math.sin(angle) * force * repulsionStrength;
          
          // Aumentar opacidad cerca del mouse
          particle.opacity = Math.min(1, particle.baseOpacity + force * 0.4);
        } else {
          particle.opacity = particle.baseOpacity;
        }

        // Movimiento natural
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Rebote suave en los bordes
        if (particle.x < 0) {
          particle.x = 0;
          particle.vx *= -0.8;
        }
        if (particle.x > canvas.width) {
          particle.x = canvas.width;
          particle.vx *= -0.8;
        }
        if (particle.y < 0) {
          particle.y = 0;
          particle.vy *= -0.8;
        }
        if (particle.y > canvas.height) {
          particle.y = canvas.height;
          particle.vy *= -0.8;
        }

        // Fricción
        particle.vx *= 0.97;
        particle.vy *= 0.97;

        // Limitar velocidad
        const maxSpeed = 2;
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }

        // Dibujar partícula como línea/dash (similar a Google Antigravity)
        ctx.save();
        ctx.translate(particle.x, particle.y);
        const angle = Math.atan2(particle.vy, particle.vx);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-particle.size * 2, 0);
        ctx.lineTo(particle.size * 2, 0);
        ctx.strokeStyle = `rgba(1, 175, 0, ${particle.opacity})`;
        ctx.lineWidth = particle.size;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Dibujar conexiones entre partículas cercanas
        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = otherParticle.x - particle.x;
          const dy = otherParticle.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.2 * Math.min(particle.opacity, otherParticle.opacity);
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(1, 175, 0, ${opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="interactive-background-canvas" />;
}

