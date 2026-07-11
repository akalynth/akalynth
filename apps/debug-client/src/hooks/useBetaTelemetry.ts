import { useEffect, useRef } from 'react';
import type { MapName } from '@shared/http';
import type { GameClientState } from '../types';
import { sendBetaEvent } from '../services/betaTelemetry';

function nextTutorialStep(state: GameClientState): string | undefined {
  const loop = state.loop;
  if (!loop) return undefined;
  if (!loop.move) return 'move';
  if (!loop.chat) return 'chat';
  if (!loop.tem) return 'tem';
  if (!loop.gate) return 'gate';
  return loop.complete ? 'complete' : undefined;
}

export function useBetaTelemetry(httpBase: string, state: GameClientState): void {
  const startedAt = useRef(Date.now());
  const previousPhase = useRef(state.conn.phase);
  const previousWorld = useRef(Boolean(state.world.me));
  const sentOnboardingStart = useRef(false);
  const sentOnboardingComplete = useRef(false);

  useEffect(() => {
    sendBetaEvent(httpBase, 'browser_mount', { map: state.world.map.name as MapName });
    sendBetaEvent(httpBase, 'play_session_started', { map: state.world.map.name as MapName });

    const onError = () => sendBetaEvent(httpBase, 'browser_error', { reason: 'window_error' });
    const onRejection = () => sendBetaEvent(httpBase, 'browser_error', { reason: 'unhandled_rejection' });
    const onPageHide = () => sendBetaEvent(httpBase, 'play_session_ended', { duration_ms: Date.now() - startedAt.current });
    const originalConsoleError = console.error;
    const onConsoleError = (...args: unknown[]) => {
      originalConsoleError(...args);
      sendBetaEvent(httpBase, 'browser_error', { reason: 'console_error' });
    };
    console.error = onConsoleError;
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('pagehide', onPageHide);
      if (console.error === onConsoleError) console.error = originalConsoleError;
    };
  }, [httpBase]);

  useEffect(() => {
    if (state.conn.phase === previousPhase.current) return;
    if (state.conn.phase === 'connected') {
      sendBetaEvent(httpBase, 'ws_connected', { map: state.world.map.name as MapName });
    } else if (state.conn.phase === 'disconnected' || state.conn.phase === 'error') {
      sendBetaEvent(httpBase, 'ws_disconnected', { map: state.world.map.name as MapName, reason: state.conn.phase });
    }
    previousPhase.current = state.conn.phase;
  }, [httpBase, state.conn.phase, state.conn.reason, state.world.map.name]);

  useEffect(() => {
    const hasWorld = Boolean(state.world.me);
    if (hasWorld && !previousWorld.current) {
      sendBetaEvent(httpBase, 'world_state_reached', { map: state.world.map.name as MapName });
    }
    previousWorld.current = hasWorld;
  }, [httpBase, state.world.map.name, state.world.me]);

  useEffect(() => {
    if (state.loop && !sentOnboardingStart.current) {
      sentOnboardingStart.current = true;
      sendBetaEvent(httpBase, 'onboarding_started', {
        map: state.world.map.name as MapName,
        tutorial_step: nextTutorialStep(state),
      });
    }
    if (state.loop?.complete && !sentOnboardingComplete.current) {
      sentOnboardingComplete.current = true;
      sendBetaEvent(httpBase, 'onboarding_completed', {
        map: state.world.map.name as MapName,
        tutorial_step: 'complete',
      });
    }
  }, [httpBase, state.loop, state.world.map.name]);
}
