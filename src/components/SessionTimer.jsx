import { useState, useEffect } from 'react';
import { getElapsedTime } from '../utils/dateTime';

export default function SessionTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(() => getElapsedTime(startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedTime(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="session-timer" title="Session duration (visual only)">
      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center' }}>
        Duration
      </span>
      {elapsed}
    </div>
  );
}
