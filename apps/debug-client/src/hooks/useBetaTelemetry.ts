import { useEffect, useRef } from 'react';
import type { MapName } from '@shared/http';
import type { GameClientState } from '../types';
import { sendBetaEvent } from '../services/betaTelemetry';

interface BetaDocumentLifecycle {
  browserMountSent: boolean;
  activeSessionStartedAt: number | null;
}

const lifecycleByHttpBase = new Map<string, BetaDocumentLifecycle>();

function lifecycleFor(httpBase: string): BetaDocumentLifecycle {
  const existing = lifecycleByHttpBase.get(httpBase);
  if (existing) return existing;
  const lifecycle: BetaDocumentLifecycle = {
    browserMountSent: false,
    activeSessionStartedAt: null,
  };
  lifecycleByHttpBase.set(httpBase, lifecycle);
  return lifecycle;
}

function startPlaySession(
  httpBase: string,
  lifecycle: BetaDocumentLifecycle,
  map: MapName,
): void {
  if (lifecycle.activeSessionStartedAt !== null) return;
  lifecycle.activeSessionStartedAt = Date.now();
  sendBetaEvent(httpBase, 'play_session_started', { map });
}

function endPlaySession(
  httpBase: string,
  lifecycle: BetaDocumentLifecycle,
): void {
  const startedAt = lifecycle.activeSessionStartedAt;
  if (startedAt === null) return;
  lifecycle.activeSessionStartedAt = null;
  sendBetaEvent(httpBase, 'play_session_ended', {
    duration_ms: Math.max(0, Date.now() - startedAt),
  });
}

export function nextBetaTutorialStep(state: GameClientState): string | undefined {
  const loop = state.loop;
  if (!loop) return undefined;
  if (loop.rookguardQuest) {
    const nextQuestStep = loop.rookguardQuest.steps.find((step) => !step.complete)?.step_id;
    return nextQuestStep ?? (loop.rookguardQuest.completed ? 'complete' : undefined);
  }
  if (!loop.move) return 'move';
  if (!loop.chat) return 'chat';
  if (!loop.tem) return 'tem';
  if (!loop.gate) return 'gate';
  return loop.complete ? 'complete' : undefined;
}

export function betaOnboardingComplete(state: GameClientState): boolean {
  const loop = state.loop;
  if (!loop) return false;
  return loop.rookguardQuest ? loop.rookguardQuest.completed : loop.complete;
}

export function useBetaTelemetry(httpBase: string, state: GameClientState): void {
  const previousPhase = useRef(state.conn.phase);
  const previousWorld = useRef(Boolean(state.world.me));
  const sentOnboardingStart = useRef(false);
  const sentOnboardingComplete = useRef(false);
  const currentMap = useRef(state.world.map.name as MapName);
  currentMap.current = state.world.map.name as MapName;

  useEffect(() => {
    const lifecycle = lifecycleFor(httpBase);
    if (!lifecycle.browserMountSent) {
      lifecycle.browserMountSent = true;
      sendBetaEvent(httpBase, 'browser_mount', { map: currentMap.current });
    }
    startPlaySession(httpBase, lifecycle, currentMap.current);

    const onError = () => sendBetaEvent(httpBase, 'browser_error', { reason: 'window_error' });
    const onRejection = () => sendBetaEvent(httpBase, 'browser_error', { reason: 'unhandled_rejection' });
    const onPageHide = () => endPlaySession(httpBase, lifecycle);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) startPlaySession(httpBase, lifecycle, currentMap.current);
    };
    const originalConsoleError = console.error;
    const onConsoleError = (...args: unknown[]) => {
      originalConsoleError(...args);
      sendBetaEvent(httpBase, 'browser_error', { reason: 'console_error' });
    };
    console.error = onConsoleError;
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      if (console.error === onConsoleError) console.error = originalConsoleError;
    };
  }, [httpBase]);

  useEffect(() => {
    if (state.conn.phase === previousPhase.current) return;
    if (state.conn.phase === 'connected') {
      sendBetaEvent(httpBase, 'ws_connected', { map: state.world.map.name as MapName });
    } else if (state.conn.phase === 'disconnected' || state.conn.phase === 'error') {
      sendBetaEvent(httpBase, 'ws_disconnected', {
        map: state.world.map.name as MapName,
        reason: state.conn.phase,
      });
    }
    previousPhase.current = state.conn.phase;
  }, [httpBase, state.conn.phase, state.world.map.name]);

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
        tutorial_step: nextBetaTutorialStep(state),
      });
    }
    if (betaOnboardingComplete(state) && !sentOnboardingComplete.current) {
      sentOnboardingComplete.current = true;
      sendBetaEvent(httpBase, 'onboarding_completed', {
        map: state.world.map.name as MapName,
        tutorial_step: 'complete',
      });
    }
  }, [httpBase, state.loop, state.world.map.name]);
}
