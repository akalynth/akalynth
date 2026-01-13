import { useEffect, useRef } from 'react';

export interface LogEntry {
  id: string;
  ts: number;
  type: 'connect' | 'spawn' | 'move' | 'join' | 'leave' | 'disconnect' | 'error';
  text: string;
}

interface EventLogProps {
  entries: LogEntry[];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

export function EventLog({ entries }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="event-log">
      <div className="event-log__header">Truth Log</div>
      <div className="event-log__body">
        {entries.length === 0 && (
          <div className="event-log__empty">Waiting for server events...</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={`event-log__line event-log__line--${e.type}`}>
            <span className="event-log__ts">{formatTime(e.ts)}</span>
            <span className="event-log__type">[{e.type}]</span>
            <span className="event-log__text">{e.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
