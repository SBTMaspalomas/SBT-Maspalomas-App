import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}

export function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="block w-full touch-none rounded-lg"
          onPointerDown={(e) => {
            drawingRef.current = true;
            const { x, y } = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.strokeStyle = "#0b1220";
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawingRef.current) return;
            const { x, y } = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.lineTo(x, y);
            ctx.stroke();
            setHasInk(true);
          }}
          onPointerUp={() => {
            drawingRef.current = false;
            onChange(canvasRef.current!.toDataURL("image/png"));
          }}
          onPointerLeave={() => { drawingRef.current = false; }}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const c = canvasRef.current!;
            const ctx = c.getContext("2d")!;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, c.width, c.height);
            setHasInk(false);
            onChange(undefined);
          }}
        >
          Borrar firma
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          {hasInk ? "Firma capturada" : "Firma con el dedo o el ratón"}
        </span>
      </div>
    </div>
  );
}
