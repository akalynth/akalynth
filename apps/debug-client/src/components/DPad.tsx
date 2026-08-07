import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { InputDirection } from '../types';
import { HudChromePanel } from './HudChromePanel';
import { TextureCircle } from './TextureCircle';

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
  { label: '■', dir: null },
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
  const activePointerDirs = useRef(new Set<InputDirection>());

  const releasePointerDir = useCallback((dir: InputDirection) => {
    if (!activePointerDirs.current.has(dir)) return;
    activePointerDirs.current.delete(dir);
    onRelease(dir);
  }, [onRelease]);

  const releaseAllPointerDirs = useCallback(() => {
    for (const dir of activePointerDirs.current) {
      onRelease(dir);
    }
    activePointerDirs.current.clear();
  }, [onRelease]);

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

  useEffect(() => {
    const releaseOnVisibilityChange = () => {
      if (document.visibilityState !== 'visible') releaseAllPointerDirs();
    };
    window.addEventListener('pointerup', releaseAllPointerDirs);
    window.addEventListener('pointercancel', releaseAllPointerDirs);
    window.addEventListener('blur', releaseAllPointerDirs);
    document.addEventListener('visibilitychange', releaseOnVisibilityChange);
    return () => {
      window.removeEventListener('pointerup', releaseAllPointerDirs);
      window.removeEventListener('pointercancel', releaseAllPointerDirs);
      window.removeEventListener('blur', releaseAllPointerDirs);
      document.removeEventListener('visibilitychange', releaseOnVisibilityChange);
    };
  }, [releaseAllPointerDirs]);

  return (
    <HudChromePanel className="dpad-shell" variant="dpad" padding={8}>
    <div className="dpad" role="group" aria-label="Movement pad">
      {buttons.map((b, idx) => (
        <TextureCircle
          key={idx}
          variant="dpad-button"
          size={44}
          className={`dpad-btn ${b.dir ? '' : 'dpad-btn--stop'}`}
        >
        <button
          type="button"
          className="dpad-btn__hit"
          aria-label={b.dir ? `Move ${b.dir.replace('_', ' ')}` : 'Stop movement'}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            if (b.dir) {
              activePointerDirs.current.add(b.dir);
              onMove(b.dir);
            } else {
              releaseAllPointerDirs();
              onStopAll();
            }
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            if (b.dir) releasePointerDir(b.dir);
          }}
          onPointerLeave={() => b.dir && releasePointerDir(b.dir)}
          onPointerCancel={() => b.dir && releasePointerDir(b.dir)}
        >
          {b.label}
        </button>
        </TextureCircle>
      ))}
    </div>
    </HudChromePanel>
  );
}
