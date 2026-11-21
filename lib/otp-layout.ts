// Icon of each service (used on the service cards of the apron scene, components/ApronStand.tsx).
// Positions on the map live in lib/apron.ts.
export type NodePos = { icon: string };

export const LAYOUT: Record<string, NodePos> = {
  ground_start: { icon: "M6 21V4m0 0h11l-2.5 4L17 12H6" },
  deboard: { icon: "M12 4v9m0 0l-3-3m3 3l3-3M6 20h12" },
  bags_unload: { icon: "M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 7h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 11v4m0 0l-2-2m2 2l2-2" },
  boarding: { icon: "M12 14V5m0 0l-3 3m3-3l3 3M6 20h12" },
  cleaning: { icon: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" },
  fuel: { icon: "M6 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M5 20h10M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-2-2M8 8h4" },
  bags_load: { icon: "M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 7h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 15v-4m0 0l-2 2m2-2l2 2" },
  catering: { icon: "M4 17h16M5 17a7 7 0 0 1 14 0M12 8V6M10 6h4" },
  doors_closed: { icon: "M6 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M4 20h16M13 12h.01" },
  off_block: { icon: "M4 12h14m0 0l-4-4m4 4l-4 4" },
};

/** A service the DB knows about but this table does not: a plain plus icon instead of being dropped. */
export const FALLBACK: NodePos = { icon: "M12 5v14M5 12h14" };

