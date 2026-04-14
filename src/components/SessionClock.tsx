"use client";

import { useState, useEffect, memo } from "react";

interface Session {
  name: string;
  openHourUTC: number;
  closeHourUTC: number;
}

const SESSIONS: Session[] = [
  { name: "Sydney", openHourUTC: 21, closeHourUTC: 6 },   // 9PM–6AM UTC
  { name: "Tokyo", openHourUTC: 0, closeHourUTC: 9 },      // 12AM–9AM UTC
  { name: "London", openHourUTC: 7, closeHourUTC: 16 },    // 7AM–4PM UTC
  { name: "New York", openHourUTC: 12, closeHourUTC: 21 }, // 12PM–9PM UTC
];

function isSessionActive(session: Session, hourUTC: number): boolean {
  if (session.openHourUTC < session.closeHourUTC) {
    // Normal range (e.g., 7–16)
    return hourUTC >= session.openHourUTC && hourUTC < session.closeHourUTC;
  } else {
    // Wraps midnight (e.g., 21–6)
    return hourUTC >= session.openHourUTC || hourUTC < session.closeHourUTC;
  }
}

function SessionClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const hourUTC = now.getUTCHours();

  return (
    <div className="flex items-center gap-3 overflow-x-auto sm:gap-4">
      {SESSIONS.map((session) => {
        const active = isSessionActive(session, hourUTC);
        return (
          <div key={session.name} className="flex shrink-0 items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                active ? "bg-green shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-zinc-700"
              }`}
            />
            <span
              className={`text-[10px] font-medium sm:text-[11px] ${
                active ? "text-foreground" : "text-muted/60"
              }`}
            >
              {session.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(SessionClock);
