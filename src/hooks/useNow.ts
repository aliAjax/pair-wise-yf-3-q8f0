import { useEffect, useState } from 'react';

/** 每 60 秒刷新一次当前时间，用于回访倒计时等相对时间展示 */
export function useNow(intervalMs = 60000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
