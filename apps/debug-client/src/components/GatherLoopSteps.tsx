import { LOOP_STEP_LABELS, type GatherLoopStep } from '../data/gatherLabels';

interface GatherLoopStepsProps {
  step: GatherLoopStep;
  /** When true, all three steps show as complete (post-deliver idle with status). */
  loopCompleteHint?: boolean;
}

/**
 * Compact Gather → Attune → Deliver checklist (display-only).
 * Step is derived from server-backed held item; see contract §2.3.1.
 */
export function GatherLoopSteps({ step, loopCompleteHint = false }: GatherLoopStepsProps) {
  return (
    <ol className="gather-loop-steps" aria-label="Ley mote loop steps">
      {LOOP_STEP_LABELS.map((label, index) => {
        const n = (index + 1) as GatherLoopStep;
        const done = loopCompleteHint || n < step;
        const current = !loopCompleteHint && n === step;
        return (
          <li
            key={label}
            className={[
              'gather-loop-step',
              done ? 'gather-loop-step--done' : '',
              current ? 'gather-loop-step--current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={current ? 'step' : undefined}
          >
            <span className="gather-loop-step__num" aria-hidden="true">
              {done ? '✓' : n}
            </span>
            <span className="gather-loop-step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
