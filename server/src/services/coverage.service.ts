export function getCoverageInfo() {
  return {
    corridor: 'Mumbai JNPT Port to Pune Chakan MIDC Industrial Freight Corridor',
    region: 'Maharashtra, India (Raigad & Pune Districts)',
    highwaysCovered: [
      'National Highway 48 (Mumbai-Pune Expressway)',
      'Old Mumbai-Pune National Highway (Old NH 48)',
      'State Highway 55 (Talegaon-Chakan Industrial Highway)',
      'NH 348A (JNPT Port Link Road)',
      'NH 60 (Pune-Nashik Highway Sector)',
    ],
    supportedVehicleTypes: ['container', 'tanker', 'tipper', 'flatbed'],
    supportedCargoTypes: ['general', 'hazardous', 'perishable'],
    supportedRestrictionTypes: [
      'max_weight_t',
      'max_height_m',
      'max_width_m',
      'time_ban',
      'axle_limit',
    ],
    supportedHazardTypes: [
      'closure',
      'waterlogging',
      'landslide',
      'accident',
      'weight_check',
    ],
    geographicBounds: {
      minLat: 18.6,
      maxLat: 19.1,
      minLng: 72.9,
      maxLng: 73.9,
    },
    totalCorridorNodes: 21,
    totalCorridorEdges: 23,
    disclaimer:
      'ClearRoute AI is a hackathon prototype developed strictly for demonstration along the Mumbai-Pune industrial corridor. Real-world commercial vehicle routing must comply with verified on-ground signboards, police directives, and dynamic Ministry of Road Transport and Highways (MoRTH) circulars. Actual real-world coverage is simulated for hackathon evaluation.',
  };
}
