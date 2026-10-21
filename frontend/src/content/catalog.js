/* Production-suite content from the SIMQO design. Geometry in metres from the site
   floor plan (18 m × 8 m, origin top-left). Room ids match the VR app's results.json. */
export const PASS_MARK = 80;

export const rooms = [
 {
  "id": "wash",
  "name": "Wash Area",
  "x": 0,
  "y": 0,
  "w": 4,
  "h": 3,
  "door": 2.3,
  "zone": "clean",
  "module": "cleaning",
  "equipment": [
   "Stainless steel wash sinks with brushes",
   "Parts washer (washing machine)",
   "Potable and purified water outlets",
   "Drying cabinet with filtered air",
   "Status labels: Dirty / Clean"
  ],
  "source": "SOP-EQ-012 Cleaning of equipment parts.",
  "steps": [
   "Receive dirty parts with a Dirty status label",
   "Dismantle to the cleaning procedure",
   "Pre-rinse with potable water to remove gross residue",
   "Wash with detergent and brushes or in the parts washer",
   "Rinse with potable water, then final rinse with purified water",
   "Visually inspect for residue, swab if required",
   "Dry in the drying cabinet",
   "Wrap, label Clean with date and clean-hold expiry, move to Clean Store"
  ]
 },
 {
  "id": "blister",
  "name": "Blister Packing",
  "x": 4,
  "y": 0,
  "w": 3,
  "h": 3,
  "door": 5.2,
  "zone": "clean",
  "equipment": [
   "Velocity V300 blister packer (Accupack), double lane, max 300 blisters/min",
   "Forming film: PVC, PVC/PVDC or Duplex",
   "Lidding: hard Al, soft Al or laminated paper",
   "Upper-left hopper / feeder, HMI, stack light",
   "Right-side discharge conveyor to cartoning"
  ],
  "source": "SOP-PK-021 Velocity V300 blister packer operation; SOP-PK-022 Blister leak testing.",
  "steps": [
   "Line clearance and material check",
   "Forming material setup",
   "Web advance (two lanes)",
   "Blister cavity forming",
   "Product feeding from the hopper",
   "Lidding material introduction",
   "Roller sealing",
   "Cutting",
   "Finished blister discharge",
   "In-process leak test of sealed blisters"
  ]
 },
 {
  "id": "tableting",
  "name": "Tableting",
  "x": 7,
  "y": 0,
  "w": 3,
  "h": 3,
  "door": 8.4,
  "zone": "clean",
  "equipment": [
   "Rotary tablet press",
   "Rotary turret with die table",
   "Upper and lower punches with dust bellows",
   "Feeder shoe and hopper",
   "Pre-compression and main compression rollers",
   "Ejection cam and scraper blade",
   "Weight, thickness and hardness tester"
  ],
  "source": "SOP-TB-008 Rotary tablet press operation and in-process checks.",
  "steps": [
   "Check tooling and clean status of the press",
   "Filling: lower punch drops, die fills from the feeder",
   "Excess powder scraped level with the die table",
   "Pre-compression expels trapped air",
   "Main compression forms the tablet",
   "Ejection along the cam",
   "Scraper directs tablets to the chute",
   "In-process checks: weight, thickness, hardness"
  ]
 },
 {
  "id": "granulation",
  "name": "Granulation",
  "x": 10,
  "y": 0,
  "w": 3,
  "h": 3,
  "door": 11.4,
  "zone": "clean",
  "module": "granulation",
  "equipment": [
   "Rapid mixer granulator (RMG)",
   "RMG touch panel",
   "Intermediate bulk container (IBC)",
   "IBC lifter"
  ],
  "source": "SOP-GR-004 High-shear wet granulation; SOP-GR-006 Top-spray fluid bed agglomeration.",
  "steps": null
 },
 {
  "id": "blending",
  "name": "Blending",
  "x": 13,
  "y": 0,
  "w": 5,
  "h": 3,
  "door": 15.4,
  "zone": "clean",
  "height": 5,
  "equipment": [
   "IBC bin blender with post hoist (the 5 m ceiling allows lifting and tumbling the bin)",
   "Intermediate bulk containers (IBCs)",
   "Sampling thief",
   "Status labels: Quarantine / Released"
  ],
  "source": "SOP-BL-003 IBC bin blending and blend uniformity sampling.",
  "steps": [
   "Line clearance and clean status of the blender",
   "Verify materials against the batch record",
   "Charge granules and extragranular excipients into the IBC",
   "Lock the IBC onto the blender and close the guard",
   "Blend for the set number of revolutions",
   "Add lubricant and run the short final blend",
   "Take blend uniformity samples from several locations",
   "Label the IBC as Quarantine pending QC release"
  ]
 },
 {
  "id": "gowning",
  "name": "Gowning Area",
  "x": 0,
  "y": 5,
  "w": 3,
  "h": 3,
  "door": 1.8,
  "zone": "clean",
  "entry": "Personnel in / out",
  "module": "gowning",
  "equipment": [
   "Checklist",
   "Hand gloves",
   "Hazmat suit",
   "Shoes",
   "Face mask"
  ],
  "source": "SOP-QA-002 Cleanroom gowning and entry.",
  "steps": null
 },
 {
  "id": "cleanstore",
  "name": "Clean Store",
  "x": 3,
  "y": 5,
  "w": 3,
  "h": 3,
  "door": 4.4,
  "zone": "clean",
  "equipment": [
   "Stainless steel racking, off the floor",
   "Wrapped clean equipment and change parts",
   "Clean store logbook"
  ],
  "source": "SOP-EQ-015 Clean equipment storage and clean-hold time.",
  "steps": [
   "Check the Clean label and clean-hold expiry on receipt",
   "Store wrapped items on designated racking, off the floor",
   "Keep clean and dirty items segregated",
   "Issue first-expiry-first-out",
   "Record each issue in the logbook",
   "Return expired items to the Wash Area for re-cleaning"
  ]
 },
 {
  "id": "cartoning",
  "name": "Cartoning",
  "x": 6,
  "y": 5,
  "w": 3,
  "h": 3,
  "door": 7.4,
  "zone": "clean",
  "equipment": [
   "Cartoner fed from the V300 discharge",
   "Leaflet folder / feeder",
   "Batch code and expiry printer with vision check",
   "Check-weigher with reject bin"
  ],
  "source": "SOP-PK-024 Cartoning and printed packaging reconciliation.",
  "steps": [
   "Line clearance",
   "Verify cartons and leaflets against the batch record",
   "Set up the printer and verify the first batch code and expiry",
   "Challenge the reject systems (missing leaflet, wrong code, underweight)",
   "Feed blisters from the V300",
   "Erect carton, insert blisters and leaflet, close",
   "Check-weigh and reject",
   "Reconcile printed packaging materials at the end"
  ]
 },
 {
  "id": "dispensary",
  "name": "Dispensary",
  "x": 9,
  "y": 5,
  "w": 4,
  "h": 3,
  "door": 11.2,
  "zone": "clean",
  "booths": true,
  "equipment": [
   "Actives (API) booth, 2 × 3 m, with downflow air",
   "Excipients booth, 2 × 3 m, with downflow air",
   "Calibrated balances",
   "Scoops and dispensing containers"
  ],
  "source": "SOP-WD-005 Dispensing of raw materials.",
  "steps": [
   "Verify the batch record and material labels (name, lot, status)",
   "Daily balance check with a test weight",
   "Weigh actives in the API booth",
   "Weigh excipients in the excipients booth",
   "Second-person check of each weight",
   "Label and seal dispensed containers"
  ]
 },
 {
  "id": "goods",
  "name": "Goods In / Out",
  "x": 13,
  "y": 5,
  "w": 2,
  "h": 3,
  "door": 13.6,
  "zone": "clean",
  "entry": "Goods in / out",
  "airlock": true,
  "equipment": [
   "Airlock with shutter doors closing from above",
   "Door interlock: only one set opens at a time",
   "Plastic transfer pallets",
   "70% IPA wipes for outer packaging"
  ],
  "source": "SOP-WH-009 Material transfer through the goods airlock.",
  "steps": [
   "Remove outer shipping layer outside the airlock",
   "Open the outer shutter and bring materials in",
   "Close the outer shutter",
   "Wipe down containers with 70% IPA",
   "Transfer from wooden to plastic pallets",
   "Open the inner shutter only after the outer one is closed",
   "Move materials into the corridor and close the shutter"
  ]
 },
 {
  "id": "water",
  "name": "Water Plant",
  "x": 15,
  "y": 5,
  "w": 3,
  "h": 3,
  "door": null,
  "zone": "unclassified",
  "equipment": [
   "Pre-treatment: multimedia filter, softener, carbon filter",
   "Reverse osmosis and EDI",
   "Purified water storage tank and distribution loop",
   "Conductivity, TOC and temperature monitors"
  ],
  "source": "SOP-UT-011 Purified water system monitoring.",
  "steps": [
   "Check pre-treatment status and softener regeneration",
   "Check the RO / EDI unit is running and alarm-free",
   "Record loop conductivity (limit 1.3 µS/cm at 25 °C)",
   "Record loop TOC (limit 500 ppb)",
   "Check loop temperature and return flow",
   "Take microbiological samples at points of use"
  ]
 }
];

/* Step-by-step actions (and, where defined, pass criteria and common errors) for rooms whose steps are defined by a module. */
export const roomDetails = {
 "gowning": {
  "title": "Cleanroom Gowning",
  "steps": [
   "Hand gloves",
   "Hazmat suit",
   "Face mask",
   "Shoes"
  ],
  "detail": [
   {
    "sub": [
     "Approach the glove box.",
     "Press Grab to pick up the gloves.",
     "Release to wear them. The gloves disappear from your hand, and the checklist updates."
    ],
    "criteria": [],
    "errors": []
   },
   {
    "sub": [
     "Approach the hazmat suit.",
     "Press Grab to pick it up.",
     "Release to wear it. The suit disappears from your hand, and the checklist updates."
    ],
    "criteria": [],
    "errors": []
   },
   {
    "sub": [
     "Approach the mask box.",
     "Press Grab to pick up a mask.",
     "Release to wear it. The mask disappears from your hand, and the checklist updates."
    ],
    "criteria": [],
    "errors": []
   },
   {
    "sub": [
     "Approach the shoe rack.",
     "Press Grab to pick up the shoes.",
     "Release to wear them. The shoes disappear from your hand, and the checklist updates."
    ],
    "criteria": [],
    "errors": []
   }
  ],
  "skills": [
   [
    "Gowning sequence",
    "blue"
   ],
   [
    "Aseptic technique",
    "yellow"
   ],
   [
    "Contamination control",
    "purple"
   ],
   [
    "Self-inspection",
    "orange"
   ]
  ]
 },
 "granulation": {
  "title": "Wet Granulation",
  "steps": [
   "Loading",
   "Mixing"
  ],
  "detail": [
   {
    "sub": [
     "Approach the RMG touch panel.",
     "Press Load IBC.",
     "Wait for the lifter to raise and rotate the IBC into the loading position.",
     "Wait for loading to finish before starting mixing."
    ],
    "criteria": [],
    "errors": []
   },
   {
    "sub": [
     "Press Start Mixing on the RMG touch panel.",
     "Wait for the mixing cycle to finish.",
     "The session ends, and the results are saved."
    ],
    "criteria": [],
    "errors": []
   }
  ],
  "skills": [
   [
    "Process sequence",
    "mint"
   ],
   [
    "Equipment handling",
    "yellow"
   ],
   [
    "Material state recognition",
    "purple"
   ],
   [
    "Airflow & spray control",
    "orange"
   ]
  ]
 }
};

/* My Training: one card per room. targetMin = expected time in room. */
export const roomCards = {
 "gowning": {
  "image": "room-gowning.jpg",
  "progress": 100,
  "targetMin": 12,
  "firstPass": false,
  "purpose": "Put on cleanroom garments in the right order so you do not carry contamination into the clean zone."
 },
 "wash": {
  "image": "room-wash.jpg",
  "progress": 100,
  "targetMin": 15,
  "firstPass": false,
  "purpose": "Clean equipment parts until they are free of residue, so nothing carries over from one batch to the next."
 },
 "cleanstore": {
  "image": "room-cleanstore.jpg",
  "progress": 100,
  "targetMin": 9,
  "firstPass": true,
  "purpose": "Keep cleaned equipment protected, segregated and within its clean-hold time until it is needed."
 },
 "goods": {
  "image": "room-goods.jpg",
  "progress": 100,
  "targetMin": 7,
  "firstPass": true,
  "purpose": "Bring materials into the clean zone, and send goods out, without letting contamination in through the airlock."
 },
 "dispensary": {
  "image": "room-dispensary.jpg",
  "progress": 100,
  "targetMin": 22,
  "firstPass": true,
  "purpose": "Weigh exactly the right amount of each material for the batch, with actives and excipients kept apart."
 },
 "granulation": {
  "image": "module-granulation.jpg",
  "progress": 40,
  "targetMin": 35,
  "purpose": "Turn fine powder into dense, free-flowing granules that compress evenly into tablets."
 },
 "blending": {
  "image": "room-blending.jpg",
  "progress": 0,
  "targetMin": 18,
  "purpose": "Mix granules, excipients and lubricant into a uniform blend so every tablet gets the same dose."
 },
 "tableting": {
  "image": "room-tableting.jpg",
  "progress": 0,
  "targetMin": 20,
  "purpose": "Compress the final blend into tablets with the right weight, thickness and hardness."
 },
 "blister": {
  "image": "room-blister.jpg",
  "progress": 0,
  "targetMin": 22,
  "purpose": "Seal tablets into blister packs that protect them from moisture, light and tampering."
 },
 "cartoning": {
  "image": "room-cartoning.jpg",
  "progress": 0,
  "targetMin": 18,
  "purpose": "Pack blisters and the patient leaflet into cartons printed with the correct batch code and expiry."
 },
 "water": {
  "image": "room-water.jpg",
  "progress": 0,
  "targetMin": 12,
  "purpose": "Produce and monitor purified water, the most used raw material in the plant."
 }
};

export const roomCardOrder = ["gowning","wash","cleanstore","goods","dispensary","granulation","blending","tableting","blister","cartoning","water"];

/* Assessment points per step, weighted by GMP risk (most rooms total 100; Gowning totals 10 and Granulation 20, matching the VR app). [points, critical]. An error on a critical step fails the attempt. */
export const roomPoints = {"gowning":[[2,0],[3,0],[3,0],[2,0]],"wash":[[5,0],[10,0],[10,0],[15,0],[20,1],[15,1],[10,0],[15,1]],"cleanstore":[[25,1],[15,0],[15,1],[15,0],[10,0],[20,0]],"goods":[[10,0],[10,0],[15,0],[15,1],[15,1],[25,1],[10,0]],"dispensary":[[15,1],[15,1],[20,1],[15,0],[20,1],[15,0]],"granulation":[[10,0],[10,0]],"blending":[[10,1],[15,1],[10,0],[10,0],[15,0],[15,0],[15,1],[10,0]],"tableting":[[10,1],[15,0],[10,0],[10,0],[15,0],[10,0],[10,0],[20,1]],"blister":[[10,1],[10,0],[5,0],[10,0],[10,0],[10,0],[15,1],[10,0],[10,0],[10,0]],"cartoning":[[10,1],[15,1],[15,1],[15,0],[5,0],[10,0],[15,0],[15,0]],"water":[[10,0],[10,0],[25,1],[25,1],[10,0],[20,0]]};

export const roomById = Object.fromEntries(rooms.map((room) => [room.id, room]));

export function roomSteps(room) {
  return room.steps || roomDetails[room.module]?.steps || [];
}

// Total points available in a room.
export function roomTotalPoints(id) {
  return (roomPoints[id] || []).reduce((sum, [points]) => sum + points, 0);
}

// Rooms with no critical steps (Gowning, Granulation) do not track critical errors.
export function tracksCriticalErrors(id) {
  return (roomPoints[id] || []).some(([, critical]) => critical);
}

export function roomName(id) {
  return roomById[id]?.name ?? "Unknown room";
}
