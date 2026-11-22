// Reference positions (lon, lat) and names of the airports that appear in the flight file, used only to place flights on the tower map.
// The airports table has no coordinates yet; an IATA code missing here is simply not drawn (the map says how many flights it left out).
export type AirportGeo = { lon: number; lat: number; name: string };

export const AIRPORT_GEO: Record<string, AirportGeo> = {
  CAI: { lon: 31.4056, lat: 30.1219, name: "Cairo" },
  HBE: { lon: 29.6964, lat: 30.9177, name: "Borg El Arab" },
  SSH: { lon: 34.395, lat: 27.9773, name: "Sharm El Sheikh" },
  HRG: { lon: 33.7994, lat: 27.1783, name: "Hurghada" },
  LXR: { lon: 32.7066, lat: 25.671, name: "Luxor" },
  ASW: { lon: 32.82, lat: 23.9644, name: "Aswan" },
  DXB: { lon: 55.3657, lat: 25.2532, name: "Dubai" },
  SHJ: { lon: 55.5172, lat: 25.3286, name: "Sharjah" },
  AUH: { lon: 54.6511, lat: 24.433, name: "Abu Dhabi" },
  DOH: { lon: 51.6081, lat: 25.2731, name: "Doha" },
  KWI: { lon: 47.9689, lat: 29.2266, name: "Kuwait" },
  RUH: { lon: 46.6988, lat: 24.9576, name: "Riyadh" },
  JED: { lon: 39.1565, lat: 21.6796, name: "Jeddah" },
  MED: { lon: 39.7051, lat: 24.5534, name: "Madinah" },
  AMM: { lon: 35.9932, lat: 31.7226, name: "Amman" },
  BEY: { lon: 35.4884, lat: 33.8209, name: "Beirut" },
  IST: { lon: 28.7519, lat: 41.2753, name: "Istanbul" },
  SAW: { lon: 29.3092, lat: 40.8986, name: "Istanbul Sabiha" },
  AYT: { lon: 30.8005, lat: 36.8987, name: "Antalya" },
  FCO: { lon: 12.2389, lat: 41.8003, name: "Rome" },
  FRA: { lon: 8.5706, lat: 50.0333, name: "Frankfurt" },
  CDG: { lon: 2.5479, lat: 49.0097, name: "Paris CDG" },
  LHR: { lon: -0.4543, lat: 51.47, name: "London Heathrow" },
  SVO: { lon: 37.4146, lat: 55.9726, name: "Moscow Sheremetyevo" },
  LED: { lon: 30.2625, lat: 59.8003, name: "St Petersburg" },
  GOJ: { lon: 43.784, lat: 56.2301, name: "Nizhny Novgorod" },
  KUF: { lon: 50.1643, lat: 53.5049, name: "Samara" },
  UFA: { lon: 55.8744, lat: 54.5575, name: "Ufa" },
};

export const geoOf = (code: string | null | undefined): AirportGeo | null => (code ? AIRPORT_GEO[code.trim().toUpperCase()] ?? null : null);
