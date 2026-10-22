"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { canvasToScreenshot, tokenColor, type Screenshot } from "../lib/images";

type Box = { x: number; y: number; width: number; height: number };

const normalise = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** Draw boxes around the problem on a picture. The boxes are burnt into the image. */
export function AnnotateDialog({
  shot,
  onSave,
  onClose,
}: {
  shot: Screenshot | null;
  onSave: (next: Screenshot) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const [saving, setSaving] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !image || !ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(3, canvas.width / 400);
    ctx.strokeStyle = tokenColor("--destructive", "red");
    for (const box of draft ? [...boxes, draft] : boxes) {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
  }, [boxes, draft]);

  useEffect(() => {
    if (!shot) return;
    setBoxes([]);
    setDraft(null);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      draw();
    };
    image.src = shot.url;
    // draw is intentionally not a dependency: only reload when the picture changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  useEffect(() => draw(), [draw]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!shot || !canvas) return;
    setSaving(true);
    try {
      onSave(await canvasToScreenshot(canvas, shot.source));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={shot !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mark the problem</DialogTitle>
          <DialogDescription>
            Press and drag on the picture to draw a box around what is wrong.
            You can draw more than one box.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/40">
          <canvas
            ref={canvasRef}
            className="block h-auto w-full cursor-crosshair touch-none"
            aria-label="Picture to mark"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              startRef.current = point(event);
            }}
            onPointerMove={(event) => {
              if (startRef.current) setDraft(normalise(startRef.current, point(event)));
            }}
            onPointerUp={(event) => {
              const start = startRef.current;
              startRef.current = null;
              setDraft(null);
              if (!start) return;
              const box = normalise(start, point(event));
              if (box.width > 6 && box.height > 6) setBoxes((current) => [...current, box]);
            }}
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={boxes.length === 0}
              onClick={() => setBoxes((current) => current.slice(0, -1))}
            >
              Undo last box
            </Button>
            <Button variant="ghost" disabled={boxes.length === 0} onClick={() => setBoxes([])}>
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save picture"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
