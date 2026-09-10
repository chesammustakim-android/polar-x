from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Expedition(Base):
    __tablename__ = "expeditions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    sub_title = Column(String, nullable=True)
    location = Column(String, nullable=False)
    base_station = Column(String, nullable=True, default="Maitri Station")
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    status = Column(String, default="Active")
    phase = Column(String, nullable=True)
    leader = Column(String, nullable=True)
    personnel_count = Column(Integer, default=0)
    cargo_weight = Column(String, default="0 Tons")
    readiness = Column(Integer, default=90)
    vessel_support = Column(String, nullable=True)

    cargo_items = relationship("Cargo", back_populates="expedition")
    personnel_members = relationship("Personnel", back_populates="expedition")
    inventory_items = relationship("Inventory", back_populates="expedition")
    inventory_requirements = relationship("ExpeditionInventoryRequirement", back_populates="expedition", cascade="all, delete-orphan")


class Cargo(Base):
    __tablename__ = "cargo"

    id = Column(Integer, primary_key=True, index=True)
    cargo_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, default="General Supply")
    weight = Column(String, default="1.0 Tons")
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    status = Column(String, default="Preparing") # Preparing, In Transit, At Port, Loaded, Delivered, Delayed
    priority = Column(String, default="Medium")   # Critical, High, Medium, Low
    transit_mode = Column(String, default="Vessel")
    rfid_tag = Column(String, nullable=True)
    temperature_log = Column(String, default="-4°C")
    eta = Column(String, default="In Transit")
    current_location = Column(String, default="Warehouse")
    last_updated = Column(String, default="Just now")
    notes = Column(String, nullable=True)
    stage = Column(String, default="Warehouse") # Warehouse, Port, Ship, Antarctica, Research Station
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    expedition_id = Column(Integer, ForeignKey("expeditions.id"), nullable=True)
    expedition = relationship("Expedition", back_populates="cargo_items")
    
    movements = relationship(
        "CargoMovement", 
        back_populates="cargo", 
        cascade="all, delete-orphan",
        order_by="desc(CargoMovement.id)"
    )


class CargoMovement(Base):
    __tablename__ = "cargo_movements"

    id = Column(Integer, primary_key=True, index=True)
    cargo_id = Column(Integer, ForeignKey("cargo.id"), nullable=False, index=True)
    status = Column(String, nullable=False)       # Preparing, In Transit, At Port, Loaded, Delivered, Delayed
    location = Column(String, nullable=False)     # e.g., "Kochi Port", "MV Vasiliy Golovnin Cargo Bay", "Maitri Station Dock"
    timestamp = Column(String, nullable=False)    # e.g., "2026-09-01 12:45 UTC"
    notes = Column(String, nullable=True)

    cargo = relationship("Cargo", back_populates="movements")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String, unique=True, index=True, nullable=False)
    item_name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, default="Other") # Food, Fuel, Medical, Scientific Equipment, Clothing, Communication, Safety Equipment, Spare Parts, Other
    quantity = Column(Float, default=0.0, nullable=False)
    minimum_quantity = Column(Float, default=0.0, nullable=False)
    unit = Column(String, default="Units")
    location = Column(String, default="Maitri Storage Bunker")
    burn_rate = Column(String, default="Standard")
    days_remaining = Column(Integer, default=100)
    status = Column(String, default="NORMAL") # OUT_OF_STOCK, CRITICAL, LOW_STOCK, NORMAL
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)

    expedition_id = Column(Integer, ForeignKey("expeditions.id"), nullable=True)
    expedition = relationship("Expedition", back_populates="inventory_items")

    transactions = relationship(
        "InventoryTransaction",
        back_populates="inventory",
        cascade="all, delete-orphan",
        order_by="desc(InventoryTransaction.id)"
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False, index=True)
    transaction_type = Column(String, nullable=False) # STOCK_IN, STOCK_OUT, ADJUSTMENT
    quantity = Column(Float, nullable=False)
    previous_quantity = Column(Float, nullable=False)
    new_quantity = Column(Float, nullable=False)
    timestamp = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    user = Column(String, default="Station Logistics Officer")

    inventory = relationship("Inventory", back_populates="transactions")


class ExpeditionInventoryRequirement(Base):
    __tablename__ = "expedition_inventory_requirements"

    id = Column(Integer, primary_key=True, index=True)
    expedition_id = Column(Integer, ForeignKey("expeditions.id"), nullable=False, index=True)
    category = Column(String, nullable=False)
    item_name = Column(String, nullable=True)
    required_quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False, default="Units")

    expedition = relationship("Expedition", back_populates="inventory_requirements")


class Personnel(Base):
    __tablename__ = "personnel"

    id = Column(Integer, primary_key=True, index=True)
    personnel_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="Scientist")
    department = Column(String, nullable=False, default="Science & Research")
    contact = Column(String, nullable=True)
    status = Column(String, default="AT_STATION") # AT_STATION, FIELD, IN_TRANSIT, RESTING, EMERGENCY, OFF_DUTY
    current_location = Column(String, nullable=False, default="Maitri Station")
    latitude = Column(Float, nullable=False, default=-70.7670)
    longitude = Column(Float, nullable=False, default=11.7400)
    specialization = Column(String, nullable=True)
    heart_rate = Column(String, default="72 bpm")
    spo2 = Column(String, default="98%")
    body_temp = Column(String, default="36.8°C")
    battery = Column(String, default="90%")
    emergency_contact = Column(String, nullable=True)
    last_updated = Column(String, nullable=True)
    created_at = Column(String, nullable=True)

    expedition_id = Column(Integer, ForeignKey("expeditions.id"), nullable=True)
    expedition = relationship("Expedition", back_populates="personnel_members")

    movements = relationship(
        "PersonnelMovement",
        back_populates="personnel",
        cascade="all, delete-orphan",
        order_by="desc(PersonnelMovement.id)"
    )
    incidents = relationship("Incident", back_populates="personnel")


class PersonnelMovement(Base):
    __tablename__ = "personnel_movements"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    previous_location = Column(String, nullable=True)
    new_location = Column(String, nullable=False)
    previous_latitude = Column(Float, nullable=True)
    previous_longitude = Column(Float, nullable=True)
    new_latitude = Column(Float, nullable=False)
    new_longitude = Column(Float, nullable=False)
    status = Column(String, nullable=False) # AT_STATION, FIELD, IN_TRANSIT, RESTING, EMERGENCY, OFF_DUTY
    timestamp = Column(String, nullable=False)
    movement_type = Column(String, nullable=False) # DEPARTURE, ARRIVAL, FIELD_MOVEMENT, VEHICLE_MOVEMENT, RETURN_TO_BASE, MANUAL_UPDATE
    notes = Column(String, nullable=True)

    personnel = relationship("Personnel", back_populates="movements")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, default="System") # Distress, Weather, Resource, Operational
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, default="INFO") # INFO, WARNING, CRITICAL
    timestamp = Column(String, nullable=False)
    status = Column(String, default="ACTIVE") # ACTIVE, IN_PROGRESS, RESOLVED, MONITORING
    source = Column(String, default="Station Telemetry")
    action_required = Column(String, default="None")
    coordinates = Column(String, nullable=True)


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, nullable=False, default="Research Station") # Research Station, Field Outpost, Storage Depot, Logistics Camp, Drill Site, Water Facility
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(String, nullable=True, default="100m ASL")
    status = Column(String, default="OPERATIONAL") # OPERATIONAL, MAINTENANCE, SEASONAL_ACTIVE
    description = Column(String, nullable=True)
    region = Column(String, nullable=True, default="Antarctica")
    created_at = Column(String, nullable=True)

    resource_requirements = relationship(
        "StationResourceRequirement",
        back_populates="station",
        cascade="all, delete-orphan"
    )
    consumption_records = relationship(
        "DailyConsumptionRecord",
        back_populates="station",
        cascade="all, delete-orphan"
    )


class ResponseUnit(Base):
    __tablename__ = "response_units"

    id = Column(Integer, primary_key=True, index=True)
    unit_code = Column(String, unique=True, index=True, nullable=False) # e.g., SAR-01, MED-01
    name = Column(String, nullable=False)
    unit_type = Column(String, nullable=False, default="FIELD_TEAM") # MEDICAL_TEAM, FIELD_TEAM, VEHICLE, HELICOPTER, RESCUE_TEAM, STATION_SUPPORT, OTHER
    team = Column(String, nullable=False, default="Maitri SAR")
    status = Column(String, nullable=False, default="AVAILABLE") # AVAILABLE, DISPATCHED, ON_MISSION, UNAVAILABLE, RETURNING, OFF_DUTY
    capabilities = Column(String, nullable=True) # e.g., "Trauma Care, Hypothermia Triage, Crevasse Extraction"
    current_location = Column(String, nullable=False, default="Maitri SAR Depot")
    latitude = Column(Float, nullable=False, default=-70.7670)
    longitude = Column(Float, nullable=False, default=11.7400)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)

    assigned_incidents = relationship("Incident", back_populates="assigned_unit")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_code = Column(String, unique=True, index=True, nullable=False) # e.g., INC-2026-001
    title = Column(String, nullable=False)
    incident_type = Column(String, nullable=False, default="OTHER") # MEDICAL, MISSING_PERSON, VEHICLE, CARGO, FIRE, COMMUNICATION_LOSS, WEATHER_ENVIRONMENTAL, OTHER
    severity = Column(String, nullable=False, default="HIGH") # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String, nullable=False, default="REPORTED") # REPORTED, ACKNOWLEDGED, TRIAGED, DISPATCHED, IN_PROGRESS, RESOLVED, CANCELLED
    
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True, index=True)
    reported_by = Column(String, nullable=False, default="Station Telemetry")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String, nullable=False, default="Unknown Polar Sector")
    description = Column(String, nullable=True)

    assigned_unit_id = Column(Integer, ForeignKey("response_units.id"), nullable=True, index=True)

    created_at = Column(String, nullable=False)
    acknowledged_at = Column(String, nullable=True)
    dispatched_at = Column(String, nullable=True)
    resolved_at = Column(String, nullable=True)
    resolution_notes = Column(String, nullable=True)

    personnel = relationship("Personnel", back_populates="incidents")
    assigned_unit = relationship("ResponseUnit", back_populates="assigned_incidents")
    events = relationship(
        "IncidentEvent",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="desc(IncidentEvent.id)"
    )


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False) # INCIDENT_CREATED, INCIDENT_ACKNOWLEDGED, TRIAGE_UPDATED, UNIT_ASSIGNED, UNIT_DISPATCHED, INCIDENT_STARTED, LOCATION_UPDATED, INCIDENT_RESOLVED, INCIDENT_CANCELLED
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    actor = Column(String, nullable=False, default="Logistics Director")
    timestamp = Column(String, nullable=False)

    incident = relationship("Incident", back_populates="events")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="FIELD_OPERATOR") # ADMIN, EXPEDITION_DIRECTOR, LOGISTICS_OFFICER, EXPEDITION_LEADER, SAR_OFFICER, FIELD_OPERATOR, STATION_HEAD
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(String, nullable=True)
    last_login = Column(String, nullable=True)
    station = Column(String, default="Maitri Station")
    assigned_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)

    assigned_station = relationship("Station", foreign_keys=[assigned_station_id])


class StationResourceRequirement(Base):
    """
    Persisted minimum required quantities for specific inventory resources per station.
    Ensures stations maintain required fuel, rations, medical, and spare buffers.
    """
    __tablename__ = "station_resource_requirements"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False, index=True)
    item_code = Column(String, nullable=False, index=True)
    item_name = Column(String, nullable=True)
    minimum_quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String, nullable=True, default="Units")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)

    station = relationship("Station", back_populates="resource_requirements")


class DailyConsumptionRecord(Base):
    """
    Daily persistent consumption registry for operational resources at polar stations.
    Captures station, resource, date, quantity consumed, and recording user.
    """
    __tablename__ = "daily_consumption_records"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False, index=True)
    item_code = Column(String, nullable=False, index=True)
    item_name = Column(String, nullable=True)
    consumption_date = Column(String, nullable=False, index=True) # YYYY-MM-DD
    consumed_quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String, nullable=True, default="Units")
    recorded_at = Column(String, nullable=False)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    recorded_by = Column(String, nullable=False, default="Station Officer")
    notes = Column(String, nullable=True)

    station = relationship("Station", back_populates="consumption_records")
    user = relationship("User", foreign_keys=[recorded_by_user_id])


class SystemSetting(Base):
    """
    Persistent system-wide configuration key/value store.
    data_type: string | integer | float | boolean
    All values are stored as strings; typed getters cast on read.
    """
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)          # Always stored as string
    data_type = Column(String, nullable=False, default="string")  # string | integer | float | boolean
    label = Column(String, nullable=True)           # Human-readable label
    description = Column(String, nullable=True)     # Tooltip / help text
    category = Column(String, nullable=True, default="system")  # system | operational | notifications | automation
    updated_by = Column(String, nullable=True)      # Username of last editor
    updated_at = Column(String, nullable=True)



