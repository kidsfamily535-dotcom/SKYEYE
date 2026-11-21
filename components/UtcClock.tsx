"use client";
import { useEffect, useState } from "react";
export default function UtcClock() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { setN(Date.now()); const i = setInterval(() => setN(Date.now()), 20000); return () => clearInterval(i); }, []);
  return <span className="cr-badge ltr">UTC · {n === null ? "—" : new Date(n).toISOString().slice(11, 16)}</span>;
}
