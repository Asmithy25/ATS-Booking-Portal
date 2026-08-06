import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#A95532', '#D39A52', '#D9B7A2', '#71805A', '#F2D6B8'];

export function CelebrationConfetti({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);
  const pieces = useMemo(
    () => Array.from({ length: 28 }, (_, index) => ({
      id: index,
      color: COLORS[index % COLORS.length],
      left: `${8 + ((index * 37) % 84)}%`,
      delay: `${(index % 7) * 45}ms`,
      duration: `${900 + (index % 5) * 110}ms`,
      rotation: `${(index * 53) % 360}deg`,
    })),
    [],
  );

  useEffect(() => {
    if (!trigger || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={`${trigger}-${piece.id}`}
          className="ats-confetti-piece"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            '--confetti-rotation': piece.rotation,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}