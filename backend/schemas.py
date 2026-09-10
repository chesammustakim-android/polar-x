from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# --- EXPEDITION SCHEMAS ---
class ExpeditionBase(BaseModel):
    name: str
    sub_title: Optional[str] = None
    location: str
    base_station: Optional[str] = "Maitri Station"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = "Active"
    phase: Optional[str] = None
    leader: Optional[str] = None
    personnel_count: Optional[int] = 0
    cargo_weight: Optional[str] = "0 Tons"
    readiness: Optional[int] = 90
    vessel_support: Optional[str] = None

class ExpeditionCreate(ExpeditionBase):
    pass

class ExpeditionOut(ExpeditionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- CARGO MOVEMENT SCHEMAS ---
class CargoMovementBase(BaseModel):
    status: str
    location: str
    timestamp: Optional[str] = None
    notes: Optional[str] = None

class CargoMovementCreate(CargoMovementBase):
    pass

class CargoMovementOut(CargoMovementBase):
    id: int
    cargo_id: int
    model_config = ConfigDict(from_attributes=True)


# --- CARGO SCHEMAS ---
class CargoBase(BaseModel):
    cargo_code: str
    name: str
    category: Optional[str] = "General Supply"
    weight: Optional[str] = "1.0 Tons"
    origin: str
    destination: str
    status: Optional[str] = "Preparing" # Preparing, In Transit, At Port, Loaded, Delivered, Delayed
    priority: Optional[str] = "Medium"   # Critical, High, Medium, Low
    transit_mode: Optional[str] = "Vessel"
    rfid_tag: Optional[str] = None
    temperature_log: Optional[str] = "-4°C"
    eta: Optional[str] = "In Transit"
    current_location: Optional[str] = "Warehouse"
    last_updated: Optional[str] = "Just now"
    notes: Optional[str] = None
    stage: Optional[str] = "Warehouse" # Warehouse, Port, Ship, Antarctica, Research Station
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    expedition_id: Optional[int] = None

class CargoCreate(CargoBase):
    pass

class CargoUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    weight: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    transit_mode: Optional[str] = None
    rfid_tag: Optional[str] = None
    temperature_log: Optional[str] = None
    eta: Optional[str] = None
    current_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    stage: Optional[str] = None
    expedition_id: Optional[int] = None

class CargoOut(CargoBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class CargoDetailOut(CargoOut):
    expedition_name: Optional[str] = None
    movements: List[CargoMovementOut] = []
    model_config = ConfigDict(from_attributes=True)

class CargoLocationMapOut(BaseModel):
    id: int
    cargo_code: str
    name: str
    category: str
    weight: str
    origin: str
    destination: str
    status: str
    priority: str
    current_location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    expedition_id: Optional[int] = None
    expedition_name: Optional[str] = None
    last_updated: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CargoQRDataOut(BaseModel):
    cargo_id: int
    cargo_code: str
    name: str
    category: str
    weight: str
    origin: str
    destination: str
    status: str
    priority: str
    current_location: str
    last_updated: str
    qr_payload: str
    download_url: Optional[str] = None

class CargoSummaryStatsOut(BaseModel):
    total_cargo: int
    in_transit: int
    delivered: int
    high_priority: int
    delayed: int
    preparing: int
    at_port: int
    loaded: int


# --- INVENTORY TRANSACTION SCHEMAS ---
class InventoryTransactionBase(BaseModel):
    transaction_type: str # STOCK_IN, STOCK_OUT, ADJUSTMENT
    quantity: float
    previous_quantity: float
    new_quantity: float
    timestamp: Optional[str] = None
    reason: Optional[str] = None
    user: Optional[str] = "Station Logistics Officer"

class InventoryTransactionCreate(BaseModel):
    transaction_type: str # STOCK_IN, STOCK_OUT, ADJUSTMENT
    quantity: float
    reason: Optional[str] = None
    user: Optional[str] = "Station Logistics Officer"

class InventoryTransactionOut(InventoryTransactionBase):
    id: int
    inventory_id: int
    model_config = ConfigDict(from_attributes=True)


# --- INVENTORY SCHEMAS ---
class InventoryBase(BaseModel):
    item_code: str
    item_name: str
    category: Optional[str] = "Other"
    quantity: float = 0.0
    minimum_quantity: float = 0.0
    unit: Optional[str] = "Units"
    location: Optional[str] = "Maitri Storage Bunker"
    burn_rate: Optional[str] = "Standard"
    days_remaining: Optional[int] = 100
    expedition_id: Optional[int] = None

class InventoryCreate(InventoryBase):
    pass

class InventoryUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    minimum_quantity: Optional[float] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    burn_rate: Optional[str] = None
    days_remaining: Optional[int] = None
    expedition_id: Optional[int] = None

class InventoryStockUpdate(BaseModel):
    transaction_type: str # STOCK_IN, STOCK_OUT, ADJUSTMENT
    quantity: float
    reason: Optional[str] = None
    user: Optional[str] = "Station Logistics Officer"

class InventoryOut(InventoryBase):
    id: int
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    expedition_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InventoryDetailOut(InventoryOut):
    transactions: List[InventoryTransactionOut] = []
    model_config = ConfigDict(from_attributes=True)

class InventorySummaryStatsOut(BaseModel):
    total_items: int
    low_stock: int
    critical: int
    out_of_stock: int
    normal: int
    total_quantity: float

# --- EXPEDITION READINESS SCHEMAS ---
class RequirementDetailOut(BaseModel):
    id: int
    expedition_id: int
    category: str
    item_name: Optional[str] = None
    required_quantity: float
    available_quantity: float
    unit: str
    status: str # READY or SHORTAGE
    fulfillment_percentage: float

class ExpeditionReadinessOut(BaseModel):
    expedition_id: int
    expedition_name: str
    location: str
    status: str # READY or NEEDS ATTENTION
    readiness_percentage: float
    total_requirements: int
    fulfilled_requirements: int
    critical_shortages_count: int
    requirements: List[RequirementDetailOut]


# --- PERSONNEL MOVEMENT SCHEMAS ---
class PersonnelMovementBase(BaseModel):
    previous_location: Optional[str] = None
    new_location: str
    previous_latitude: Optional[float] = None
    previous_longitude: Optional[float] = None
    new_latitude: float
    new_longitude: float
    status: str
    timestamp: Optional[str] = None
    movement_type: str # DEPARTURE, ARRIVAL, FIELD_MOVEMENT, VEHICLE_MOVEMENT, RETURN_TO_BASE, MANUAL_UPDATE
    notes: Optional[str] = None

class PersonnelMovementCreate(BaseModel):
    new_location: str
    new_latitude: float
    new_longitude: float
    status: Optional[str] = "AT_STATION"
    movement_type: Optional[str] = "MANUAL_UPDATE"
    notes: Optional[str] = None

class PersonnelMovementOut(PersonnelMovementBase):
    id: int
    personnel_id: int
    model_config = ConfigDict(from_attributes=True)


# --- PERSONNEL SCHEMAS ---
class PersonnelBase(BaseModel):
    personnel_code: str
    name: str
    role: str = "Scientist"
    department: Optional[str] = "Science & Research"
    contact: Optional[str] = None
    status: Optional[str] = "AT_STATION" # AT_STATION, FIELD, IN_TRANSIT, RESTING, EMERGENCY, OFF_DUTY
    current_location: Optional[str] = "Maitri Station"
    latitude: float = -70.7670
    longitude: float = 11.7400
    specialization: Optional[str] = None
    heart_rate: Optional[str] = "72 bpm"
    spo2: Optional[str] = "98%"
    body_temp: Optional[str] = "36.8°C"
    battery: Optional[str] = "90%"
    emergency_contact: Optional[str] = None
    expedition_id: Optional[int] = None

class PersonnelCreate(PersonnelBase):
    pass

class PersonnelUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    contact: Optional[str] = None
    status: Optional[str] = None
    current_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialization: Optional[str] = None
    emergency_contact: Optional[str] = None
    expedition_id: Optional[int] = None

class PersonnelLocationUpdate(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    status: Optional[str] = "AT_STATION"
    movement_type: Optional[str] = "MANUAL_UPDATE" # DEPARTURE, ARRIVAL, FIELD_MOVEMENT, VEHICLE_MOVEMENT, RETURN_TO_BASE, MANUAL_UPDATE
    notes: Optional[str] = None

class PersonnelOut(PersonnelBase):
    id: int
    last_updated: Optional[str] = None
    created_at: Optional[str] = None
    expedition_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class PersonnelDetailOut(PersonnelOut):
    movements: List[PersonnelMovementOut] = []
    model_config = ConfigDict(from_attributes=True)

class PersonnelSummaryStatsOut(BaseModel):
    total_personnel: int
    at_station: int
    field: int
    in_transit: int
    emergency: int
    resting: int
    off_duty: int

class PersonnelLocationMapOut(BaseModel):
    id: int
    personnel_code: str
    name: str
    role: str
    department: Optional[str] = "Operations"
    status: str
    current_location: str
    latitude: float
    longitude: float
    last_updated: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- ALERT SCHEMAS ---
class AlertBase(BaseModel):
    type: Optional[str] = "System"
    title: str
    message: str
    severity: Optional[str] = "INFO"
    timestamp: str
    status: Optional[str] = "ACTIVE"
    source: Optional[str] = "Station Telemetry"
    action_required: Optional[str] = "None"
    coordinates: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    message: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    action_required: Optional[str] = None
    coordinates: Optional[str] = None

class AlertOut(AlertBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- DASHBOARD SUMMARY SCHEMAS ---
class DashboardSummaryOut(BaseModel):
    active_expeditions_count: int
    total_assets_count: int
    personnel_deployed_count: int
    cargo_in_transit_count: int
    cargo_in_transit_weight: str
    delivered_cargo_count: int
    delayed_cargo_count: int
    high_priority_cargo_count: int
    critical_alerts_count: int
    inventory_warnings_count: int
    system_status: str

class DashboardDataOut(BaseModel):
    summary: DashboardSummaryOut
    expeditions: List[ExpeditionOut]
    recent_cargo: List[CargoOut]
    recent_movements: List[CargoMovementOut] = []
    personnel: List[PersonnelOut]
    inventory: List[InventoryOut]
    alerts: List[AlertOut]


# --- STATION SCHEMAS ---
class StationBase(BaseModel):
    name: str
    type: str = "Research Station"
    latitude: float
    longitude: float
    elevation: Optional[str] = "100m ASL"
    status: Optional[str] = "OPERATIONAL"
    description: Optional[str] = None
    region: Optional[str] = "Antarctica"

class StationCreate(StationBase):
    pass

class StationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None

class StationOut(StationBase):
    id: int
    created_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- STATION RESOURCE REQUIREMENTS SCHEMAS ---
class StationResourceRequirementBase(BaseModel):
    station_id: int
    item_code: str
    item_name: Optional[str] = None
    minimum_quantity: float
    unit: Optional[str] = "Units"
    is_active: Optional[bool] = True

class StationResourceRequirementCreate(BaseModel):
    item_code: str
    minimum_quantity: float
    unit: Optional[str] = "Units"
    item_name: Optional[str] = None

class StationResourceRequirementUpdate(BaseModel):
    minimum_quantity: Optional[float] = None
    unit: Optional[str] = None
    item_name: Optional[str] = None
    is_active: Optional[bool] = None

class StationResourceRequirementOut(StationResourceRequirementBase):
    id: int
    station_name: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- DAILY CONSUMPTION REGISTRY SCHEMAS ---
class DailyConsumptionRecordBase(BaseModel):
    station_id: int
    item_code: str
    item_name: Optional[str] = None
    consumption_date: str # YYYY-MM-DD
    consumed_quantity: float
    unit: Optional[str] = "Units"
    notes: Optional[str] = None

class DailyConsumptionRecordCreate(BaseModel):
    item_code: str
    consumption_date: str
    consumed_quantity: float
    unit: Optional[str] = "Units"
    notes: Optional[str] = None
    item_name: Optional[str] = None

class DailyConsumptionRecordOut(DailyConsumptionRecordBase):
    id: int
    station_name: Optional[str] = None
    recorded_at: str
    recorded_by_user_id: Optional[int] = None
    recorded_by: str
    model_config = ConfigDict(from_attributes=True)


# --- STATION RESOURCE INTELLIGENCE SCHEMA (PASS 2) ---
class StationIntelligenceItemOut(BaseModel):
    """Deterministic station resource intelligence: burn rate, trend, forecast, risk."""
    requirement_id: int
    station_id: int
    station_name: str
    item_code: str
    item_name: str
    minimum_quantity: float
    unit: str
    # Current stock from matching Inventory row (None if no match found)
    current_stock: Optional[float] = None
    # Positive = surplus, negative = deficit
    surplus_deficit: Optional[float] = None
    # Burn rate from real DailyConsumptionRecord data
    burn_rate_value: Optional[float] = None
    burn_rate_text: str  # e.g. "140 L/day" or "Insufficient consumption history"
    # Trend from deterministic comparison: STABLE / INCREASING / DECREASING / INSUFFICIENT DATA
    trend: str
    trend_pct: Optional[float] = None
    # Forecast
    days_remaining: Optional[int] = None
    days_to_minimum: Optional[int] = None
    forecast_status: str  # e.g. "14 days until reserve breach" or "Forecast unavailable"
    # Risk
    risk_score: float
    risk_level: str  # NORMAL / LOW / CRITICAL / URGENT
    risk_factors: List[str] = []
    why_flagged: List[str] = []
    consumption_record_count: int
    has_sufficient_history: bool


# --- RESPONSE UNIT SCHEMAS ---
class ResponseUnitBase(BaseModel):
    unit_code: str
    name: str
    unit_type: Optional[str] = "FIELD_TEAM" # MEDICAL_TEAM, FIELD_TEAM, VEHICLE, HELICOPTER, RESCUE_TEAM, STATION_SUPPORT, OTHER
    team: Optional[str] = "Maitri SAR"
    status: Optional[str] = "AVAILABLE" # AVAILABLE, DISPATCHED, ON_MISSION, UNAVAILABLE, RETURNING, OFF_DUTY
    capabilities: Optional[str] = None
    current_location: Optional[str] = "Maitri SAR Depot"
    latitude: float = -70.7670
    longitude: float = 11.7400

class ResponseUnitCreate(ResponseUnitBase):
    pass

class ResponseUnitUpdate(BaseModel):
    name: Optional[str] = None
    unit_type: Optional[str] = None
    team: Optional[str] = None
    status: Optional[str] = None
    capabilities: Optional[str] = None
    current_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ResponseUnitOut(ResponseUnitBase):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    active_incident_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ResponseUnitLocationMapOut(BaseModel):
    id: int
    unit_code: str
    name: str
    unit_type: str
    team: str
    status: str
    current_location: str
    latitude: float
    longitude: float
    capabilities: Optional[str] = None
    active_incident_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ResponseUnitRecommendationOut(BaseModel):
    unit: ResponseUnitOut
    distance_km: float
    capability_match: bool
    is_available: bool
    score: float
    reason: str


# --- INCIDENT EVENT SCHEMAS ---
class IncidentEventBase(BaseModel):
    event_type: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    notes: Optional[str] = None
    actor: Optional[str] = "Logistics Director"
    timestamp: str

class IncidentEventOut(IncidentEventBase):
    id: int
    incident_id: int
    model_config = ConfigDict(from_attributes=True)


# --- INCIDENT SCHEMAS ---
class IncidentBase(BaseModel):
    title: str
    incident_type: Optional[str] = "OTHER" # MEDICAL, MISSING_PERSON, VEHICLE, CARGO, FIRE, COMMUNICATION_LOSS, WEATHER_ENVIRONMENTAL, OTHER
    severity: Optional[str] = "HIGH" # CRITICAL, HIGH, MEDIUM, LOW
    status: Optional[str] = "REPORTED" # REPORTED, ACKNOWLEDGED, TRIAGED, DISPATCHED, IN_PROGRESS, RESOLVED, CANCELLED
    personnel_id: Optional[int] = None
    reported_by: Optional[str] = "Station Telemetry"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = "Unknown Polar Sector"
    description: Optional[str] = None
    assigned_unit_id: Optional[int] = None

class IncidentCreate(IncidentBase):
    incident_code: Optional[str] = None # Generated automatically if omitted

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    personnel_id: Optional[int] = None
    reported_by: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    description: Optional[str] = None
    assigned_unit_id: Optional[int] = None
    resolution_notes: Optional[str] = None

class IncidentTriageUpdate(BaseModel):
    severity: str # CRITICAL, HIGH, MEDIUM, LOW
    notes: Optional[str] = None
    actor: Optional[str] = "Operations Commander"

class IncidentAssignUpdate(BaseModel):
    response_unit_id: int
    notes: Optional[str] = None
    actor: Optional[str] = "SAR Dispatch Controller"

class IncidentActionUpdate(BaseModel):
    notes: Optional[str] = None
    actor: Optional[str] = "SAR Officer"

class IncidentResolveUpdate(BaseModel):
    resolution_notes: str
    unit_next_status: Optional[str] = "AVAILABLE" # AVAILABLE, RETURNING
    actor: Optional[str] = "Operations Commander"

class IncidentOut(IncidentBase):
    id: int
    incident_code: str
    created_at: str
    acknowledged_at: Optional[str] = None
    dispatched_at: Optional[str] = None
    resolved_at: Optional[str] = None
    resolution_notes: Optional[str] = None
    personnel_name: Optional[str] = None
    personnel_code: Optional[str] = None
    assigned_unit_code: Optional[str] = None
    assigned_unit_name: Optional[str] = None
    assigned_unit_type: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class IncidentDetailOut(IncidentOut):
    personnel_data: Optional[PersonnelOut] = None
    assigned_unit_data: Optional[ResponseUnitOut] = None
    events: List[IncidentEventOut] = []
    recommended_units: List[ResponseUnitRecommendationOut] = []
    model_config = ConfigDict(from_attributes=True)

class IncidentSummaryStatsOut(BaseModel):
    total_incidents: int
    active_incidents: int
    critical_count: int
    high_count: int
    medium_low_count: int
    reported_count: int
    triaged_count: int
    dispatched_count: int
    in_progress_count: int
    resolved_count: int
    cancelled_count: int
    units_available: int
    units_total: int

class IncidentLocationMapOut(BaseModel):
    id: int
    incident_code: str
    title: str
    incident_type: str
    severity: str
    status: str
    location_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    personnel_name: Optional[str] = None
    assigned_unit_code: Optional[str] = None
    assigned_unit_latitude: Optional[float] = None
    assigned_unit_longitude: Optional[float] = None
    created_at: str
    model_config = ConfigDict(from_attributes=True)


# --- REPORT SCHEMAS (TASK 8) ---
class ReportsSummaryKPIs(BaseModel):
    total_expeditions: int
    active_expeditions: int
    completed_expeditions: int
    average_expedition_readiness: float
    total_cargo: int
    cargo_in_transit: int
    cargo_delivered: int
    cargo_delayed: int
    total_inventory_items: int
    low_stock_items: int
    critical_stock_items: int
    out_of_stock_items: int
    total_personnel: int
    personnel_at_station: int
    personnel_field: int
    personnel_emergency: int
    total_incidents: int
    active_incidents: int
    critical_incidents: int
    resolved_incidents: int

class OperationalInsightItem(BaseModel):
    id: str
    type: str # CRITICAL_EMERGENCY, SUPPLY_DEFICIT, DELAYED_CARGO, FIELD_RISK, LOW_READINESS
    severity: str # CRITICAL, HIGH, MEDIUM, INFO
    title: str
    message: str
    entity_id: Optional[int] = None
    entity_type: Optional[str] = None
    action_hint: Optional[str] = None

class ReportsSummaryOut(BaseModel):
    kpis: ReportsSummaryKPIs
    personnel_by_status: dict
    personnel_by_department: dict
    cargo_by_status: dict
    cargo_by_category: dict
    inventory_by_status: dict
    inventory_by_category: dict
    incidents_by_severity: dict
    incidents_by_type: dict
    incidents_by_status: dict
    expeditions_by_status: dict
    operational_insights: List[OperationalInsightItem]
    timestamp: str


# --- USER & AUTH SCHEMAS (TASK 9) ---
class UserBase(BaseModel):
    username: str
    full_name: str
    email: str
    role: str = "FIELD_OPERATOR" # ADMIN, EXPEDITION_DIRECTOR, LOGISTICS_OFFICER, EXPEDITION_LEADER, SAR_OFFICER, FIELD_OPERATOR, STATION_HEAD
    active: bool = True
    station: Optional[str] = "Maitri Station"
    assigned_station_id: Optional[int] = None
    assigned_station_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: Optional[str] = None
    last_login: Optional[str] = None
    permissions: List[str] = []
    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class DemoUserOut(BaseModel):
    username: str
    full_name: str
    role: str
    role_description: str
    station: str
    assigned_station_id: Optional[int] = None


# --- SMART AUTOMATION & PREDICTIVE OPERATIONS SCHEMAS (TASK 10) ---
class ContributingFactor(BaseModel):
    name: str
    weight: float
    impact: str # POSITIVE, NEGATIVE, NEUTRAL
    description: str

class ExpeditionReadinessAnalysisOut(BaseModel):
    expedition_id: int
    expedition_name: str
    base_station: str
    score: float
    level: str # READY, ATTENTION, AT_RISK, CRITICAL
    factors: List[ContributingFactor]
    explanation: str
    recommended_actions: List[str]

class InventoryRiskItemOut(BaseModel):
    inventory_id: int
    item_code: str
    item_name: str
    category: str
    location: str
    quantity: float
    minimum_quantity: float
    unit: str
    days_remaining: int
    risk_score: float
    risk_level: str # LOW, MEDIUM, HIGH, CRITICAL
    factors: List[ContributingFactor]
    explanation: str
    recommended_action: str
    # Pass 2: optional station intelligence enrichment
    station_name: Optional[str] = None
    burn_rate_text: Optional[str] = None
    trend: Optional[str] = None
    days_to_minimum: Optional[int] = None
    forecast_status: Optional[str] = None
    why_flagged: List[str] = []

class CargoRiskItemOut(BaseModel):
    cargo_id: int
    cargo_code: str
    name: str
    category: str
    status: str
    priority: str
    destination: str
    current_location: str
    temperature_log: Optional[str] = None
    risk_score: float
    risk_level: str # LOW, MEDIUM, HIGH, CRITICAL
    factors: List[ContributingFactor]
    explanation: str
    recommended_action: str

class PersonnelRiskItemOut(BaseModel):
    personnel_id: int
    personnel_code: str
    name: str
    role: str
    status: str
    current_location: str
    battery: str
    operational_risk_score: float
    risk_level: str # LOW, MEDIUM, HIGH, CRITICAL
    factors: List[ContributingFactor]
    explanation: str
    recommended_action: str

class EmergencyPriorityItemOut(BaseModel):
    incident_id: int
    incident_code: str
    title: str
    severity: str
    status: str
    location_name: str
    priority_rank: int
    priority_score: float
    factors: List[ContributingFactor]
    explanation: str
    recommended_action: str
    has_assigned_unit: bool
    assigned_unit_code: Optional[str] = None

class AutomationRecommendationOut(BaseModel):
    incident_id: int
    incident_code: str
    incident_title: str
    incident_severity: str
    location_name: str
    recommended_units: List[ResponseUnitRecommendationOut]

class AutomationSummaryOut(BaseModel):
    overall_fleet_readiness: float
    overall_risk_index: float
    critical_risks_count: int
    high_risks_count: int
    expeditions_analyzed: int
    inventory_items_at_risk: int
    delayed_cargo_count: int
    personnel_operational_alerts: int
    active_emergency_count: int
    top_priority_actions: List[str]
    analyzed_at: str



# ─── SYSTEM SETTINGS SCHEMAS ──────────────────────────────────────────────────

class SettingOut(BaseModel):
    id: int
    key: str
    value: str
    data_type: str            # string | integer | float | boolean
    label: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class SettingsBulkOut(BaseModel):
    """Flat dict of all settings: key -> typed Python value (int, float, bool, str), with items list."""
    settings: dict
    updated_at: Optional[str] = None
    items: Optional[List[SettingOut]] = None
    model_config = ConfigDict(extra="allow")


class SettingsUpdateItem(BaseModel):
    """Single key/value update pair."""
    key: str
    value: str   # Always submitted as string; backend validates & casts


class SettingsUpdateRequest(BaseModel):
    updates: List[SettingsUpdateItem]


SettingUpdate = SettingsUpdateItem
SettingUpdateItem = SettingsUpdateItem


