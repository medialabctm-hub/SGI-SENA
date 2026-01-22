import React from 'react';
import '../styles/components/animatedBackground.css';

export default function AnimatedBackground() {
  return (
    <div className="bubbles-container">
      {[...Array(50)].map((_, i) => {
        const randomX = (Math.random() * 150 - 75);
        const randomDelay = Math.random() * 25;
        const randomDuration = 12 + Math.random() * 15;
        const randomSize = 8 + Math.random() * 30;
        const randomOpacity = 0.08 + Math.random() * 0.25;
        return (
          <div 
            key={i} 
            className="bubble" 
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${randomDelay}s`,
              animationDuration: `${randomDuration}s`,
              width: `${randomSize}px`,
              height: `${randomSize}px`,
              opacity: randomOpacity,
              '--move-x': `${randomX}px`
            }}
          />
        );
      })}
    </div>
  );
}

