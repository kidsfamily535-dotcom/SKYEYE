"use client";
import { useEffect, useRef } from "react";

/** Keeps the newest message in view when the conversation grows or the agent's state changes. */
export default function ChatScroll({ signal }: { signal: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [signal]);
  return <div ref={end} aria-hidden="true" />;
}
