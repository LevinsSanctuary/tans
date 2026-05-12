function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getToday(): string {
  return toLocalISODate(new Date());
}

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toLocalISODate(d);
}

export function getDaysOfWeek(weekStart: string): string[] {
  const days: string[] = [];
  const d = new Date(weekStart + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    days.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function isEvening(): boolean {
  return new Date().getHours() >= 19;
}
