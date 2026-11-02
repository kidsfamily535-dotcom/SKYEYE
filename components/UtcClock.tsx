"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18n";

export default function UtcClock() {
  const { t: tr } = useT();
  const [t, setT] = useState("--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 16));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return (<span className="chip ltr" aria-label={tr("clock.aria")}>{t} UTC</span>);
}
