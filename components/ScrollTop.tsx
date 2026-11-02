"use client";
import { useEffect } from "react";

/** On phones the list and the reader are separate screens: start each new email at the top. */
export default function ScrollTop({ id }: { id: string }) {
  useEffect(() => { window.scrollTo({ top: 0 }); }, [id]);
  return null;
}
