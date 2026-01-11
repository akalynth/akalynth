import { useEffect, useMemo } from 'react';
import type { InputDirection } from '../types';

interface DPadProps {
  onMove: (dir: InputDirection) => void;
  onRelease: (dir: InputDirection) => void;
  onStopAll: () => void;
}

const DIRS: Array<{ label: string; dir: InputDirection | null }> = [
  { label: '↖', dir: 'north_west' },
  { label: '↑', dir: 'north' },
  { label: '↗', dir: 'north_east' },
  { label: '←', dir: 'west' },
  { label: '•', dir: null },
  { label: '→', dir: 'east' },
  { label: '↙', dir: 'south_west' },
  { label: '↓', dir: 'south' },
  { label: '↘', dir: 'south_east' },
];

const KEY_BINDINGS: Record<string, InputDirection> = {
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowLeft: 'west',
  ArrowRight: 'east',
  w: 'north',
  a: 'west',
  s: 'south',
  d: 'east',
  q: 'north_west',
  e: 'north_east',
  z: 'south_west',
  c: 'south_east',
};

export function DPad({ onMove, onRelease, onStopAll }: DPadProps) {
  const buttons = useMemo(() => DIRS, []);

  useEffect(() => {
    const downHandler = (ev: KeyboardEvent) => {
      const dir = KEY_BINDINGS[ev.key];
      if (!dir) return;
      if (ev.repeat) return;
      ev.preventDefault();
      onMove(dir);
    };
    const upHandler = (ev: KeyboardEvent) => {
      const dir = KEY_BINDINGS[ev.key];
      if (!dir) return;
      ev.preventDefault();
      onRelease(dir);
    };
    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [onMove, onRelease]);

  return (
    <div className="dpad" role="group" aria-label="Movement pad">
      {buttons.map((b, idx) => (
        <button
          key={idx}
          className="dpad-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            if (b.dir) onMove(b.dir);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            if (b.dir) onRelease(b.dir);
          }}
          onPointerLeave={() => b.dir && onRelease(b.dir)}
          onPointerCancel={() => b.dir && onRelease(b.dir)}
        >
          {b.label}
        </button>
      ))}
      <button
        className="dpad-stop"
        aria-label="Stop movement"
        onPointerDown={(e) => {
          e.preventDefault();
          onStopAll();
        }}
      >
        ✕
      </button>
    </div>
  );
}
