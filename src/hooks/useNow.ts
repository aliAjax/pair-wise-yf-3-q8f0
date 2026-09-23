import { useEffect, useState } from 'react';

/** 每 30 秒刷新一次的当前时间戳，用于回访倒计时/到期判断 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
