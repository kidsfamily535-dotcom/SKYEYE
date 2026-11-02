"use client";
import { useState } from "react";
import { useT } from "./I18n";

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? t("copy.done") : label}</button>;
}
