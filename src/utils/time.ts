export function formatTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }
  
  export function formatClock(d: Date = new Date()): string {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  
  export function secondsUntil(iso: string): number {
    return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  }
  