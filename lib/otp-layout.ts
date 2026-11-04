// Where each service sits around the aircraft (viewBox 400 x 520, nose up) and its icon.
// Tune x/y here if a real top-down photo is placed in public/otp/ (the photo should be portrait 400:520, nose up, centred).
export type NodePos = { x: number; y: number; side: "L" | "R" | "C"; icon: string };

export const LAYOUT: Record<string, NodePos> = {
  ground_start: { x: 200, y: 40, side: "C", icon: "M6 21V4m0 0h11l-2.5 4L17 12H6" },
  deboard: { x: 170, y: 108, side: "L", icon: "M12 4v9m0 0l-3-3m3 3l3-3M6 20h12" },
  bags_unload: { x: 230, y: 148, side: "R", icon: "M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 7h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 11v4m0 0l-2-2m2 2l2-2" },
  boarding: { x: 170, y: 176, side: "L", icon: "M12 14V5m0 0l-3 3m3-3l3 3M6 20h12" },
  cleaning: { x: 200, y: 252, side: "L", icon: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" },
  fuel: { x: 262, y: 258, side: "R", icon: "M6 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M5 20h10M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-2-2M8 8h4" },
  bags_load: { x: 170, y: 340, side: "L", icon: "M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 7h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 15v-4m0 0l-2 2m2-2l2 2" },
  catering: { x: 230, y: 376, side: "R", icon: "M4 17h16M5 17a7 7 0 0 1 14 0M12 8V6M10 6h4" },
  doors_closed: { x: 200, y: 444, side: "C", icon: "M6 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M4 20h16M13 12h.01" },
  off_block: { x: 200, y: 494, side: "C", icon: "M4 12h14m0 0l-4-4m4 4l-4 4" },
};

/** A service the DB knows about but this layout does not: placed in a spare slot instead of being dropped. */
export const FALLBACK: NodePos = { x: 200, y: 300, side: "C", icon: "M12 5v14M5 12h14" };
