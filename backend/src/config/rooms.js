// Production-suite rooms, in training order. Room ids are the contract with the
// VR application's results.json and with the frontend room catalog.
export const ROOMS = [
  { id: "gowning", name: "Gowning Area" },
  { id: "wash", name: "Wash Area" },
  { id: "cleanstore", name: "Clean Store" },
  { id: "goods", name: "Goods In / Out" },
  { id: "dispensary", name: "Dispensary" },
  { id: "granulation", name: "Granulation" },
  { id: "blending", name: "Blending" },
  { id: "tableting", name: "Tableting" },
  { id: "blister", name: "Blister Packing" },
  { id: "cartoning", name: "Cartoning" },
  { id: "water", name: "Water Plant" },
];

export const ROOM_IDS = new Set(ROOMS.map((room) => room.id));
export const PASS_MARK = 80;
export const REVIEW_MARK = 70;

export function roomName(id) {
  return ROOMS.find((room) => room.id === id)?.name ?? id;
}

// An error on a critical step fails the attempt. Otherwise the pass mark decides,
// and scores just below it are left for a trainer to review.
export function assessResult(score, criticalErrors) {
  if (criticalErrors > 0) return "Fail";
  if (score >= PASS_MARK) return "Pass";
  if (score >= REVIEW_MARK) return "Review";
  return "Fail";
}
