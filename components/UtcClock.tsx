"use client";
import { useEffect, useState } from "react";

export default function UtcClock() {
  const [t, setT] = useState("--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 16));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return (<span className="chip ltr" aria-label="الوقت بتوقيت UTC">{t} UTC</span>);
}
