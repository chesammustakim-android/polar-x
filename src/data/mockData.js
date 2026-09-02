/**
 * POLAR-X — Mock Data Repository
 * National Centre for Polar and Ocean Research (NCPOR) & MoES
 * Realistic Indian Polar Expedition Datasets (Maitri, Bharati, Himadri, Dakshin Gangotri)
 */

export const SYSTEM_META = {
  appName: "POLAR-X",
  subtitle: "Integrated Polar Expedition Logistics & Asset Management System",
  organization: "Ministry of Earth Sciences (MoES)",
  department: "National Centre for Polar and Ocean Research (NCPOR)",
  satComStatus: {
    network: "Dual-Band Iridium Certus® 700",
    linkStatus: "ONLINE (99.8% Signal)",
    primaryBaseCoords: "70°45'58\"S 11°44'09\"E (Maitri)",
    latency: "142 ms",
    lastHeartbeat: "Just now",
  },
  adminUser: {
    name: "Dr. Anirban Mukherjee",
    role: "Expedition Logistics Director",
    division: "NCPOR Polar Operations Directorate",
    station: "HQ - Vasco da Gama, Goa / Remote Link",
    badgeId: "NCPOR-DIR-08"
  }
};

export const SUMMARY_STATS = {
  activeExpeditions: {
    value: 3,
    subtext: "2 Antarctic • 1 Arctic",
    trend: "+1 vs last season",
    status: "good"
  },
  totalAssets: {
    value: "1,248",
    subtext: "Tracked via Cold-RFID",
    trend: "99.4% Operational",
    status: "good"
  },
  personnelDeployed: {
    value: 86,
    subtext: "42 Maitri • 28 Bharati • 16 Himadri",
    trend: "1 Emergency Flag",
    status: "warning"
  },
  cargoInTransit: {
    value: "14.2 Tons",
    subtext: "Across 4 Vessels / Convoys",
    trend: "2 Convoys In-Route",
    status: "good"
  },
  criticalAlerts: {
    value: 2,
    subtext: "1 SOS Active • 1 Low Medical",
    trend: "Immediate Action Required",
    status: "critical"
  }
};

export const POLAR_STATIONS = [
  {
    id: "STN-MAITRI",
    name: "Maitri Station",
    region: "Antarctica (Schirmacher Oasis)",
    coordinates: { lat: -70.7667, lng: 11.7333, display: "70°46'S, 11°44'E" },
    elevation: "117 m",
    established: 1989,
    status: "Operational",
    temperature: "-28°C",
    windSpeed: "42 kt (Strong Katabatic)",
    barometer: "978 hPa",
    personnelCount: 42,
    cargoCapacityTonnes: 120,
    currentCargoTonnes: 84.5,
    fuelLevelPct: 78,
    emergencyStatus: "ALERT (SOS Beacon P-042 active)"
  },
  {
    id: "STN-BHARATI",
    name: "Bharati Station",
    region: "Antarctica (Larsemann Hills)",
    coordinates: { lat: -69.4072, lng: 76.1872, display: "69°24'S, 76°11'E" },
    elevation: "35 m",
    established: 2012,
    status: "Operational",
    temperature: "-22°C",
    windSpeed: "35 kt (Moderate)",
    barometer: "986 hPa",
    personnelCount: 28,
    cargoCapacityTonnes: 150,
    currentCargoTonnes: 112.0,
    fuelLevelPct: 88,
    emergencyStatus: "Normal"
  },
  {
    id: "STN-HIMADRI",
    name: "Himadri Arctic Station",
    region: "Arctic (Ny-Ålesund, Spitsbergen, Svalbard)",
    coordinates: { lat: 78.9236, lng: 11.9286, display: "78°55'N, 11°56'E" },
    elevation: "15 m",
    established: 2008,
    status: "Operational",
    temperature: "-14°C",
    windSpeed: "18 kt (Calm)",
    barometer: "1004 hPa",
    personnelCount: 16,
    cargoCapacityTonnes: 60,
    currentCargoTonnes: 38.2,
    fuelLevelPct: 92,
    emergencyStatus: "Normal"
  },
  {
    id: "STN-DG-AWS",
    name: "Dakshin Gangotri AWS",
    region: "Antarctica (Ice Shelf)",
    coordinates: { lat: -70.0900, lng: 12.0000, display: "70°05'S, 12°00'E" },
    elevation: "0 m (Ice Shelf)",
    established: 1983,
    status: "Unmanned Weather Station & Supply Depot",
    temperature: "-34°C",
    windSpeed: "48 kt",
    barometer: "972 hPa",
    personnelCount: 0,
    cargoCapacityTonnes: 30,
    currentCargoTonnes: 12.0,
    fuelLevelPct: 65,
    emergencyStatus: "Depot Standby"
  }
];

export const EXPEDITIONS = [
  {
    id: "EXP-2027-MAITRI-43",
    name: "Maitri Expedition 2027",
    subTitle: "43rd Indian Scientific Expedition to Antarctica",
    location: "Antarctica (Queen Maud Land / Schirmacher Oasis)",
    baseStation: "Maitri Station",
    status: "Active",
    phase: "Phase 2: Scientific Deployment & Inland Traverse",
    leader: "Dr. Rajesh Sharma (NCPOR Lead Glaciologist)",
    personnel: 42,
    cargo: "8.5 Tons",
    readiness: 94,
    startDate: "2026-11-15",
    plannedEndDate: "2027-04-10",
    vesselSupport: "MV Vasiliy Golovnin (Chartered Polar Vessel)",
    keyObjectives: [
      "Subglacial lake sediment core analysis (Lake Priyadarshini)",
      "Long-term geomagnetic field monitoring & upper atmospheric studies",
      "Permafrost thermal sensor telemetry integration"
    ],
    logisticsMetrics: {
      fuelStockDays: 140,
      rationsDays: 180,
      sparePartsHealth: "96%",
      transportReadiness: "5/6 Snowcats Operational"
    }
  },
  {
    id: "EXP-2026-BHARATI-15",
    name: "Bharati Larsemann Deep Mission",
    subTitle: "15th Bharati Wintering & Oceanography Campaign",
    location: "Antarctica (Larsemann Hills / Prydz Bay)",
    baseStation: "Bharati Station",
    status: "Active",
    phase: "Phase 3: Coastal Marine Sediment Sampling",
    leader: "Dr. Priya Nair (Ocean Biogeochemistry)",
    personnel: 28,
    cargo: "4.2 Tons",
    readiness: 98,
    startDate: "2026-09-01",
    plannedEndDate: "2027-02-28",
    vesselSupport: "ORV Sagar Kanya Support Fleet",
    keyObjectives: [
      "Prydz Bay deep-sea hydrothermal sensor deployment",
      "Satellite ground station data downlink maintenance",
      "Microplastics sampling in Antarctic sea ice"
    ],
    logisticsMetrics: {
      fuelStockDays: 195,
      rationsDays: 210,
      sparePartsHealth: "99%",
      transportReadiness: "All PistenBullys Operational"
    }
  },
  {
    id: "EXP-2026-HIMADRI-18",
    name: "Himadri Arctic Winter Study",
    subTitle: "Svalbard Aerosol & Cryospheric Monitoring",
    location: "Arctic (Ny-Ålesund, Svalbard)",
    baseStation: "Himadri Station",
    status: "Active",
    phase: "Phase 1: Winter Sensor Calibration",
    leader: "Dr. Amit K. Verma (Atmospheric Physics)",
    personnel: 16,
    cargo: "1.5 Tons",
    readiness: 90,
    startDate: "2026-10-01",
    plannedEndDate: "2027-03-30",
    vesselSupport: "Research Vessel Lance / Coastal Tender",
    keyObjectives: [
      "Black carbon aerosol footprint measurement",
      "Fjord water column CTD profiling (Kongsfjorden)",
      "IndARC underwater observatory acoustic link check"
    ],
    logisticsMetrics: {
      fuelStockDays: 120,
      rationsDays: 150,
      sparePartsHealth: "94%",
      transportReadiness: "Snowmobiles Operational"
    }
  }
];

export const EMERGENCY_ALERTS = [
  {
    id: "ALT-2026-0901",
    severity: "CRITICAL",
    timestamp: "12 mins ago (13:51 UTC)",
    source: "Personnel Locator P-042 (Dr. Rajesh Sharma)",
    title: "SOS Beacon Triggered — Crevasse Zone Bravo",
    description: "Personnel P-042 triggered an automated distress signal at Lat: 70°46.8'S, Long: 11°45.2'E (3.2 km SE of Maitri main station). Local Katabatic wind gust at 45 kt. Medical beacon reporting elevated heart rate.",
    actionRequired: "SAR Snowcat Unit Alpha-1 dispatched with Trauma Medic. Estimated Intercept: 18 mins.",
    status: "IN_PROGRESS",
    assignedTeam: "Maitri SAR Team Alpha",
    coordinates: "-70.7800, 11.7533"
  },
  {
    id: "ALT-2026-0894",
    severity: "WARNING",
    timestamp: "1 hr 45 mins ago",
    source: "Maitri Medical Bay Telemetry",
    title: "Medical Supplies Projected Below Reserve Threshold",
    description: "Cold-chain trauma medication (Epi-injectors, blood expanders, sterile surgical packs) is at 32% remaining stock. With projected winter consumption, stock will hit critical buffer in 14 days.",
    actionRequired: "Expedite delivery of Cargo CRG-208 via scheduled air-drop or Convoy Alpha rendezvous.",
    status: "PENDING_APPROVAL",
    assignedTeam: "Goa Logistics Procurement Cell",
    coordinates: "Maitri Station Medical Bay"
  },
  {
    id: "ALT-2026-0888",
    severity: "INFO",
    timestamp: "3 hrs ago",
    source: "Bharati Station Asset Dock",
    title: "Cargo CRG-102 Successfully Received & Verified",
    description: "Cargo container CRG-102 containing 2x 150kW High-Efficiency Cold-Start Turbine Generators arrived via coastal landing barge. Verified and integrated into primary generator grid.",
    actionRequired: "None. Asset register updated automatically via Cold-RFID.",
    status: "RESOLVED",
    assignedTeam: "Bharati Engineering Crew",
    coordinates: "Bharati Station Fuel/Power Hub"
  },
  {
    id: "ALT-2026-0875",
    severity: "WARNING",
    timestamp: "5 hrs ago",
    source: "NCPOR Polar Meteorology Center",
    title: "Katabatic Blizzard Warning — Queen Maud Land",
    description: "Satellite storm tracking detects severe Katabatic front moving north at 65 kt. Visibility projected under 10 meters within 6 hours. Inland surface travel restricted to Class-A tracked snowcats.",
    actionRequired: "All non-essential field teams recalled to Maitri & Bharati habitats.",
    status: "MONITORING",
    assignedTeam: "Station Command",
    coordinates: "Sector 7-B Ice Sheet"
  }
];

export const CARGO_MOVEMENTS = [
  {
    id: "CRG-102",
    name: "Cold-Start Turbines & Power Modules",
    category: "Power & Energy",
    weight: "2.4 Tons",
    origin: "Cape Town Port (South Africa)",
    destination: "Bharati Station (Antarctica)",
    transitMode: "Vessel Landing Barge",
    status: "Delivered",
    rfidTag: "RFID-9941-CT-BHR",
    temperatureLog: "-4°C (Normal)",
    eta: "Delivered Today",
    priority: "High"
  },
  {
    id: "CRG-208",
    name: "Emergency Medical & Trauma Cryo-Pack",
    category: "Medical / Cold-Chain",
    weight: "0.6 Tons",
    origin: "Goa HQ -> Cape Town Airbridge",
    destination: "Maitri Station",
    transitMode: "Convoy Alpha (PistenBully 300 Polar)",
    status: "In Transit",
    rfidTag: "RFID-1044-MED-CRYO",
    temperatureLog: "-20°C (Active Cryo-Stabilized)",
    eta: "14 Hours (In Transit)",
    priority: "Critical"
  },
  {
    id: "CRG-315",
    name: "Deep Ice Core Drilling Rig & Sensors",
    category: "Scientific Instruments",
    weight: "4.8 Tons",
    origin: "NCPOR Labs (Goa, India)",
    destination: "Larsemann Hills Sector 4",
    transitMode: "MV Vasiliy Golovnin Cargo Bay",
    status: "Customs Cleared",
    rfidTag: "RFID-8812-SCI-DRILL",
    temperatureLog: "+2°C (Dry Storage)",
    eta: "4 Days (Sea Transit)",
    priority: "Medium"
  },
  {
    id: "CRG-440",
    name: "Aviation Thermal Fuel JET A-1 (Pod B)",
    category: "Hazardous / Fuel",
    weight: "5.0 Tons (6,000 Litres)",
    origin: "Dakshin Gangotri Fuel Depot",
    destination: "Maitri Station Heli-Pad",
    transitMode: "Convoy Bravo (Heavy Sled)",
    status: "In Transit",
    rfidTag: "RFID-3390-FUEL-JETA1",
    temperatureLog: "-26°C (Insulated Tanks)",
    eta: "8 Hours (Storm Delay Alert)",
    priority: "High"
  },
  {
    id: "CRG-509",
    name: "Glaciology Optical Lidar & Drone Sensors",
    category: "Aviation / Robotics",
    weight: "1.4 Tons",
    origin: "Tromsø Port (Norway)",
    destination: "Himadri Arctic Base",
    transitMode: "Coastal Tender MV Polar Queen",
    status: "In Transit",
    rfidTag: "RFID-5521-ROBO-LIDAR",
    temperatureLog: "-8°C (Shock Monitored)",
    eta: "18 Hours",
    priority: "Medium"
  }
];

export const PERSONNEL_ROSTER = [
  {
    id: "P-042",
    name: "Dr. Rajesh Sharma",
    role: "Expedition Leader & Chief Glaciologist",
    station: "Maitri Station",
    status: "SOS Beacon Active",
    vitals: { hr: "98 bpm (Elevated)", temp: "36.4°C", spo2: "96%", battery: "84%" },
    currentActivity: "Field Traverse - Crevasse Zone Bravo",
    specialization: "Ice Sheet Dynamics & Geophysics",
    emergencyContact: "+91-98230-XXXXX"
  },
  {
    id: "P-019",
    name: "Capt. Ananya Iyer",
    role: "Polar Transport & Heavy Machinery Lead",
    station: "Maitri Station (Convoy Alpha)",
    status: "Operational / In Route",
    vitals: { hr: "72 bpm", temp: "37.0°C", spo2: "99%", battery: "95%" },
    currentActivity: "Driving PistenBully Polar Unit 2",
    specialization: "Antarctic Terrain Logistics",
    emergencyContact: "+91-94451-XXXXX"
  },
  {
    id: "P-088",
    name: "Dr. Siddharth Sen",
    role: "Senior Atmospheric Physicist",
    station: "Bharati Station",
    status: "Operational",
    vitals: { hr: "68 bpm", temp: "36.8°C", spo2: "98%", battery: "92%" },
    currentActivity: "Lidar Observatory Calibration",
    specialization: "Ozone Depletion & Solar Radiation",
    emergencyContact: "+91-98711-XXXXX"
  },
  {
    id: "P-064",
    name: "Lt. Col. Vikramaditya",
    role: "Medical Doctor & SAR Commander",
    station: "Maitri Station",
    status: "Dispatched (SAR Mission)",
    vitals: { hr: "84 bpm", temp: "36.9°C", spo2: "99%", battery: "91%" },
    currentActivity: "Leading Rescue Snowcat Alpha-1",
    specialization: "Extreme Cold Emergency Medicine",
    emergencyContact: "+91-99882-XXXXX"
  },
  {
    id: "P-031",
    name: "Dr. Meenakshi Sundaram",
    role: "Marine Biologist",
    station: "Bharati Station",
    status: "Operational",
    vitals: { hr: "70 bpm", temp: "36.7°C", spo2: "98%", battery: "88%" },
    currentActivity: "Sea-Ice Core Laboratory Analysis",
    specialization: "Polar Phytoplankton Ecology",
    emergencyContact: "+91-97120-XXXXX"
  },
  {
    id: "P-112",
    name: "Er. Tashi Dorje",
    role: "Power & Microgrid Engineer",
    station: "Himadri Arctic Base",
    status: "Operational",
    vitals: { hr: "66 bpm", temp: "36.9°C", spo2: "99%", battery: "97%" },
    currentActivity: "Wind-Turbine De-Icing Maintenance",
    specialization: "Renewable Energy in Sub-Zero Climates",
    emergencyContact: "+91-98440-XXXXX"
  }
];

export const INVENTORY_RESOURCES = [
  {
    id: "RES-FUEL-JETA1",
    name: "Arctic Aviation Fuel (Jet A-1)",
    category: "Power & Fuel",
    currentStock: 39000,
    totalCapacity: 50000,
    unit: "Litres",
    percentage: 78,
    burnRate: "280 L / Day",
    daysRemaining: 139,
    status: "Optimal",
    location: "Maitri Primary Fuel Tank Farm"
  },
  {
    id: "RES-FOOD-RATIONS",
    name: "Cryo-Dehydrated & Freeze Rations",
    category: "Life Support",
    currentStock: 7650,
    totalCapacity: 9000,
    unit: "Man-Day Packs",
    percentage: 85,
    burnRate: "42 Packs / Day",
    daysRemaining: 182,
    status: "Optimal",
    location: "Maitri Central Pantry Bunker"
  },
  {
    id: "RES-MED-CRYO",
    name: "Medical Trauma & Cold-Therapy Packs",
    category: "Medical",
    currentStock: 32,
    totalCapacity: 100,
    unit: "Standard Kits",
    percentage: 32,
    burnRate: "1.2 Kits / Day",
    daysRemaining: 14,
    status: "Critical Reorder",
    location: "Station Infirmary"
  },
  {
    id: "RES-SPARE-TRACKS",
    name: "PistenBully & Snowcat Track Spares",
    category: "Machinery Spares",
    currentStock: 16,
    totalCapacity: 25,
    unit: "Segment Sets",
    percentage: 64,
    burnRate: "0.2 Sets / Month",
    daysRemaining: 240,
    status: "Good",
    location: "Mechanical Workshop Bay"
  },
  {
    id: "RES-O2-HIGHALT",
    name: "Medical Grade Cryogenic Oxygen",
    category: "Life Support",
    currentStock: 182,
    totalCapacity: 200,
    unit: "Pressurized Cylinders",
    percentage: 91,
    burnRate: "0.5 Cyl / Day",
    daysRemaining: 364,
    status: "Optimal",
    location: "Environmental Pod 3"
  }
];

export const MAP_MARKERS = [
  {
    id: "pin-maitri",
    name: "Maitri Station",
    lat: -70.7667,
    lng: 11.7333,
    x: 48, // SVG Polar grid coordinates %
    y: 52,
    type: "station",
    status: "operational",
    weather: "-28°C • 42kt",
    personnel: 42,
    isAlert: true
  },
  {
    id: "pin-bharati",
    name: "Bharati Station",
    lat: -69.4072,
    lng: 76.1872,
    x: 74,
    y: 68,
    type: "station",
    status: "operational",
    weather: "-22°C • 35kt",
    personnel: 28,
    isAlert: false
  },
  {
    id: "pin-dg",
    name: "Dakshin Gangotri Depot",
    lat: -70.0900,
    lng: 12.0000,
    x: 46,
    y: 44,
    type: "depot",
    status: "unmanned",
    weather: "-34°C • 48kt",
    personnel: 0,
    isAlert: false
  },
  {
    id: "pin-convoy-alpha",
    name: "Convoy Alpha (PistenBully)",
    lat: -70.7800,
    lng: 11.7533,
    x: 50,
    y: 54,
    type: "convoy",
    status: "in-transit",
    weather: "-30°C • 45kt",
    personnel: 4,
    isAlert: true,
    label: "SAR Alpha-1 Unit"
  },
  {
    id: "pin-vasiliy-ship",
    name: "MV Vasiliy Golovnin",
    lat: -68.5000,
    lng: 70.2000,
    x: 70,
    y: 58,
    type: "vessel",
    status: "in-transit",
    weather: "-12°C • 24kt",
    personnel: 35,
    isAlert: false,
    label: "Polar Supply Vessel"
  }
];

export const WEATHER_TELEMETRY = {
  maitri: { temp: -28, wind: 42, gust: 56, humidity: 45, pressure: 978, condition: "Blowing Snow" },
  bharati: { temp: -22, wind: 35, gust: 44, humidity: 52, pressure: 986, condition: "Clear Polar Sky" },
  himadri: { temp: -14, wind: 18, gust: 25, humidity: 68, pressure: 1004, condition: "Overcast / Cold" }
};
