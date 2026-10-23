import React, { useRef, useEffect } from 'react';

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w <= 0 || h <= 0) return;
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export const MiniCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const width = 480;
    const height = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      t += 0.02;
      const cycle = t % 8; // 8s loop

      // 1. Grass
      ctx.fillStyle = '#DCFCE7';
      ctx.fillRect(0, 0, width, height);

      // Trees
      const drawTree = (x: number, y: number, r: number) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#86EFAC';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#BBF7D0';
        ctx.fill();
      };
      drawTree(40, 30, 14);
      drawTree(160, 25, 12);
      drawTree(320, 35, 16);
      drawTree(80, height - 30, 14);
      drawTree(240, height - 25, 12);
      drawTree(400, height - 35, 15);

      // 2. Road
      const roadY = height * 0.42;
      const roadH = 64;
      const stopX = width - 90;

      // Sidewalks
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(0, roadY - 14, width, 14);
      ctx.fillRect(0, roadY + roadH, width, 14);

      // Roadway
      ctx.fillStyle = '#4B5563';
      ctx.fillRect(0, roadY, width, roadH);

      // Predictive zone
      ctx.fillStyle = 'rgba(94, 27, 72, 0.18)';
      ctx.fillRect(160, roadY, stopX - 160, roadH);
      ctx.strokeStyle = '#5E1B48';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(160, roadY, stopX - 160, roadH);
      ctx.setLineDash([]);

      // Lane line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, roadY + roadH / 2);
      ctx.lineTo(stopX - 10, roadY + roadH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stop line & crosswalk
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(stopX, roadY, 4, roadH);
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          ctx.fillRect(stopX + 8, roadY + i * 13 + 2, 20, 9);
        }
      }

      try {
        // Signal Light (switches to GREEN at cycle >= 2.0s so queue clears before amb arrives at 5.5s)
        const isGreen = cycle >= 2.0;
        const sigX = stopX + 8;
        const sigY = roadY - 38;
        ctx.fillStyle = '#1E293B';
        drawRoundRect(ctx, sigX, sigY, 14, 28, 3);
        ctx.fill();

        // Red
        ctx.beginPath();
        ctx.arc(sigX + 7, sigY + 7, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = !isGreen ? '#EF4444' : '#450A0A';
        ctx.fill();
        if (!isGreen) {
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Green
        ctx.beginPath();
        ctx.arc(sigX + 7, sigY + 21, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isGreen ? '#10B981' : '#022C22';
        ctx.fill();
        if (isGreen) {
          ctx.shadowColor = '#10B981';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 3. Queued cars starting one by one
        const carColors = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6'];
        const initialPositions = [stopX - 30, stopX - 65, stopX - 100, stopX - 135];

        initialPositions.forEach((initX, i) => {
          const startDelay = 2.0 + i * 0.7; // startup reaction delay wave
          let cx = initX;
          let reacting = false;

          if (cycle >= startDelay) {
            const moveTime = cycle - startDelay;
            cx = initX + 0.5 * 35 * moveTime * moveTime; // accel
            reacting = moveTime < 0.4;
          }

          if (cx < width + 50) {
            const laneY = roadY + roadH * 0.72;

            // Reaction amber halo
            if (reacting) {
              ctx.beginPath();
              ctx.arc(cx + 10, laneY, 15, 0, Math.PI * 2);
              ctx.strokeStyle = '#F59E0B';
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            // Car body
            ctx.fillStyle = carColors[i % carColors.length];
            drawRoundRect(ctx, cx, laneY - 6, 20, 12, 3);
            ctx.fill();
            // Windshield
            ctx.fillStyle = '#1F0A18';
            ctx.fillRect(cx + 11, laneY - 4, 4, 8);
          }
        });

        // 4. Fast Approaching Ambulance
        // Ambulance starts from left (x=10) and travels smoothly through intersection without stopping!
        const ambSpeed = 70; // px/s
        const ambX = -30 + cycle * ambSpeed;
        if (ambX < width + 50) {
          const laneY = roadY + roadH * 0.72;
          // Shadow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
          drawRoundRect(ctx, ambX + 2, laneY - 5, 26, 14, 3);
          ctx.fill();
          // White Body
          ctx.fillStyle = '#FFFFFF';
          drawRoundRect(ctx, ambX, laneY - 7, 26, 14, 3);
          ctx.fill();
          // Red Stripe
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(ambX + 3, laneY - 1, 20, 2);
          // Windshield
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(ambX + 16, laneY - 5, 5, 10);
          // Flashing Siren
          const flash = Math.floor(cycle * 12) % 2 === 0;
          ctx.fillStyle = flash ? '#EF4444' : '#2563EB';
          ctx.fillRect(ambX + 9, laneY - 2, 4, 4);
        }

        // Badge in corner
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        drawRoundRect(ctx, 12, 12, 155, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#14B8A6';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(isGreen ? '✨ QUEUE FLUSHED · 0s WAIT' : '⏳ PREDICTING FLUSH...', 18, 26);
      } catch (err) {
        console.warn('MiniCanvas render exception:', err);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#E2E8F0] bg-white group hover:shadow-teal-500/10 transition-shadow">
      <canvas ref={canvasRef} className="w-full h-auto block" />
    </div>
  );
};
