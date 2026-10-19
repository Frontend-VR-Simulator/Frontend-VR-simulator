const assets = import.meta.glob("../design/assets/*.{jpg,png,webp}", { eager: true, query: "?url", import: "default" });

export function assetUrl(fileName) {
  return assets[`../design/assets/${fileName}`] || "";
}

export const colors = { blue: "var(--blue)", yellow: "var(--yellow)", purple: "var(--purple)", orange: "var(--orange)", cyan: "var(--cyan)", mint: "var(--mint)", red: "var(--red)" };
export const scoreColor = (score) => (score >= 85 ? "mint" : score >= 70 ? "yellow" : "orange");
export const statusColor = (status) => (status === "On track" ? "mint" : status === "At risk" ? "red" : status === "Not started" ? "gray" : "yellow");
