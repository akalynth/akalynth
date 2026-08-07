import { useMemo, useState } from 'react';
import type { PlayLoopProgress } from '@shared/types';
import { HudChromePanel } from './HudChromePanel';

type OnwardRoute = NonNullable<PlayLoopProgress['onwardRoutes']>[number];

interface OnwardRoutesChipProps {
  routes: OnwardRoute[];
  className?: string;
}

/**
 * Android-parity "Next routes" chip: collapsed by default, top-end, inset from action rail.
 */
export function OnwardRoutesChip({ routes, className }: OnwardRoutesChipProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => {
    const route = routes[0];
    if (!route) return 'Next routes';
    const open = route.status === 'available';
    const completed = new Set(route.completed_objective_ids);
    const steps = route.objectives.filter(
      (objective) => objective.system !== 'ui' && objective.system !== 'android',
    );
    const done = steps.filter((objective) => completed.has(objective.id)).length;
    return `${open ? 'Open' : 'Locked'}: ${route.title} (${done}/${steps.length})`;
  }, [routes]);

  if (routes.length === 0) return null;

  return (
    <HudChromePanel
      className={['onward-routes-chip', expanded ? 'onward-routes-chip--expanded' : '', className]
        .filter(Boolean)
        .join(' ')}
      variant="panel"
      padding={10}
    >
      <button
        type="button"
        className="onward-routes-chip__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid="OnwardRoutesChip_Toggle"
      >
        <span className="onward-routes-chip__title">Next routes</span>
        {!expanded && <span className="onward-routes-chip__summary">{summary}</span>}
        <span className="onward-routes-chip__show">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <ul className="onward-routes-chip__list" data-testid="OnwardRoutesChip_List">
          {routes.map((route) => {
            const open = route.status === 'available';
            const completed = new Set(route.completed_objective_ids);
            const steps = route.objectives.filter(
              (objective) => objective.system !== 'ui' && objective.system !== 'android',
            );
            const done = steps.filter((objective) => completed.has(objective.id)).length;
            return (
              <li key={route.route_id} className={open ? 'open' : 'locked'}>
                <strong>
                  {open ? 'Open' : 'Locked'}: {route.title} ({done}/{steps.length})
                </strong>
                <span>{route.next_objective}</span>
              </li>
            );
          })}
        </ul>
      )}
    </HudChromePanel>
  );
}
