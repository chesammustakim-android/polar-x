"""
POLAR-X — RBAC Refactor Test Suite: Separate Operational Visibility from Write Authority
Validates:
1. All 7 operational roles have view access across all 11 operational modules.
2. Station Head cannot modify another station or approve/complete transfers.
3. Station Head can view across stations and create transfer requests for own station.
4. Director and Admin retain full global authority.
5. FIELD_OPERATOR cannot perform unauthorized writes.
6. Role-specific permissions for SAR, Logistics, and Expedition Leader do not regress.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal, engine
from backend import models, crud
from backend.auth import OPERATIONAL_MODULES, get_role_permissions

# Ensure all schema tables exist without dropping existing data
models.Base.metadata.create_all(bind=engine)

client = TestClient(app)

DEMO_CREDENTIALS = [
    ("admin", "ADMIN"),
    ("director", "EXPEDITION_DIRECTOR"),
    ("head.maitri", "STATION_HEAD"),
    ("logistics", "LOGISTICS_OFFICER"),
    ("leader", "EXPEDITION_LEADER"),
    ("sar", "SAR_OFFICER"),
    ("field", "FIELD_OPERATOR"),
]

def get_token(username: str) -> str:
    res = client.post("/api/auth/login", json={"username": username, "password": "Polar@2026"})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["access_token"]

def auth_headers(username: str) -> dict:
    return {"Authorization": f"Bearer {get_token(username)}"}


# ==============================================================================
# 1. VIEW ACCESS FOR ALL 7 OPERATIONAL ROLES
# ==============================================================================
def test_all_operational_roles_have_view_permissions_in_auth_mapping():
    for _, role in DEMO_CREDENTIALS:
        perms = get_role_permissions(role)
        for mod in OPERATIONAL_MODULES:
            assert mod in perms, f"Role {role} should have view permission for module {mod}"


@pytest.mark.parametrize("username,role", DEMO_CREDENTIALS)
def test_all_roles_can_view_operational_endpoints(username, role):
    headers = auth_headers(username)
    
    # 1. Stations
    res = client.get("/api/stations", headers=headers)
    assert res.status_code == 200, f"{role} cannot view stations: {res.text}"

    # 2. Inventory
    res = client.get("/api/inventory", headers=headers)
    assert res.status_code == 200, f"{role} cannot view inventory: {res.text}"

    # 3. Cargo
    res = client.get("/api/cargo", headers=headers)
    assert res.status_code == 200, f"{role} cannot view cargo: {res.text}"

    # 4. Expeditions
    res = client.get("/api/expeditions", headers=headers)
    assert res.status_code == 200, f"{role} cannot view expeditions: {res.text}"

    # 5. Personnel
    res = client.get("/api/personnel", headers=headers)
    assert res.status_code == 200, f"{role} cannot view personnel: {res.text}"

    # 6. Incidents (Emergency)
    res = client.get("/api/incidents", headers=headers)
    assert res.status_code == 200, f"{role} cannot view incidents: {res.text}"

    # 7. Transfers
    res = client.get("/api/transfers", headers=headers)
    assert res.status_code == 200, f"{role} cannot view transfers: {res.text}"

    # 8. Smart Operations / Automation
    res = client.get("/api/automation/summary", headers=headers)
    assert res.status_code == 200, f"{role} cannot view automation summary: {res.text}"

    # 9. Reports
    res = client.get("/api/reports/summary", headers=headers)
    assert res.status_code == 200, f"{role} cannot view reports summary: {res.text}"

    # 10. Settings (Read)
    res = client.get("/api/settings", headers=headers)
    assert res.status_code == 200, f"{role} cannot view settings: {res.text}"

    # 11. Station intelligence across stations
    res = client.get("/api/inventory/station-intelligence", headers=headers)
    assert res.status_code == 200, f"{role} cannot view station intelligence: {res.text}"


# ==============================================================================
# 2. STATION HEAD CAN VIEW GLOBALLY BUT CANNOT MODIFY OTHER STATIONS
# ==============================================================================
def test_station_head_view_and_modify_restrictions():
    headers = auth_headers("head.maitri")
    
    # Can view all stations
    res = client.get("/api/stations", headers=headers)
    assert res.status_code == 200
    stations = res.json()
    assert len(stations) >= 2

    # Get Maitri (assigned) and other station
    maitri = next((s for s in stations if "maitri" in s["name"].lower()), stations[0])
    other = next((s for s in stations if s["id"] != maitri["id"]), None)
    assert other is not None, "Need another station to test cross-station isolation"

    # Station Head CANNOT create a new station
    res = client.post("/api/stations", headers=headers, json={
        "name": "Unauthorized Base", "type": "Research Station", "region": "Antarctica",
        "latitude": -70.0, "longitude": 12.0
    })
    assert res.status_code == 403, "Station Head must not create stations"

    # Station Head CANNOT update another station
    res = client.put(f"/api/stations/{other['id']}", headers=headers, json={"elevation": 150.0})
    assert res.status_code == 403, "Station Head must not modify other stations"

    # Station Head CANNOT create requirements for another station
    res = client.post(f"/api/stations/{other['id']}/requirements", headers=headers, json={
        "item_code": "FUEL-999", "minimum_quantity": 500
    })
    assert res.status_code == 403, "Station Head must not create requirements for other stations"

    # Station Head CANNOT log consumption for another station
    res = client.post(f"/api/stations/{other['id']}/consumption", headers=headers, json={
        "item_code": "FUEL-001", "consumed_quantity": 10, "consumption_date": "2026-09-11"
    })
    assert res.status_code == 403, "Station Head must not log consumption for other stations"


# ==============================================================================
# 3. STATION HEAD TRANSFER RESTRICTIONS & SCOPING
# ==============================================================================
def test_station_head_transfer_workflow_scoping():
    head_headers = auth_headers("head.maitri")
    dir_headers = auth_headers("director")

    # Get stations
    res = client.get("/api/stations", headers=head_headers)
    stations = res.json()
    maitri = next((s for s in stations if "maitri" in s["name"].lower()), stations[0])
    other = next((s for s in stations if s["id"] != maitri["id"]), stations[1])

    # 1. Station Head CANNOT request transfer where destination is ANOTHER station
    res = client.post(f"/api/transfers?destination_station_id={other['id']}", headers=head_headers, json={
        "source_station_id": maitri["id"],
        "item_code": "FUEL-001",
        "requested_quantity": 50
    })
    assert res.status_code == 403, "Station Head cannot request transfer with destination as another station"

    # 2. Station Head CAN request transfer for their own station
    res = client.post(f"/api/transfers?destination_station_id={maitri['id']}", headers=head_headers, json={
        "source_station_id": other["id"],
        "item_code": "FUEL-001",
        "requested_quantity": 25,
        "request_reason": "Emergency fuel resupply for Maitri"
    })
    assert res.status_code == 201, f"Station Head should request for own station: {res.text}"
    transfer = res.json()
    transfer_id = transfer["id"]

    # 3. Station Head CANNOT approve transfer
    res = client.post(f"/api/transfers/{transfer_id}/approve", headers=head_headers, json={
        "action": "APPROVED", "approved_quantity": 25
    })
    assert res.status_code == 403, "Station Head cannot approve transfers"

    # 4. Director CAN approve transfer
    res = client.post(f"/api/transfers/{transfer_id}/approve", headers=dir_headers, json={
        "action": "APPROVED", "approved_quantity": 25
    })
    assert res.status_code == 200, f"Director must be able to approve transfer: {res.text}"

    # 5. Station Head CANNOT complete transfer
    res = client.post(f"/api/transfers/{transfer_id}/complete", headers=head_headers, json={})
    assert res.status_code == 403, "Station Head cannot complete transfers"

    # 6. Director CAN complete transfer
    res = client.post(f"/api/transfers/{transfer_id}/complete", headers=dir_headers, json={})
    assert res.status_code == 200, f"Director must be able to complete transfer: {res.text}"


# ==============================================================================
# 4. FIELD OPERATOR WRITE RESTRICTIONS (VIEW YES, WRITE NO)
# ==============================================================================
def test_field_operator_cannot_perform_unauthorized_writes():
    headers = auth_headers("field")

    # 1. Cannot create inventory
    res = client.post("/api/inventory", headers=headers, json={
        "item_code": f"FO-INV-{uuid.uuid4().hex[:6]}", "item_name": "Field Kit", "category": "Other", "quantity": 10, "minimum_quantity": 2
    })
    assert res.status_code == 403, "Field operator cannot create inventory"

    # 2. Cannot perform inventory stock ops
    res = client.post("/api/inventory/1/stock", headers=headers, json={
        "transaction_type": "STOCK_OUT", "quantity": 1
    })
    assert res.status_code == 403, "Field operator cannot perform stock operations"

    # 3. Cannot create cargo
    res = client.post("/api/cargo", headers=headers, json={
        "cargo_code": f"CRG-FO-{uuid.uuid4().hex[:6]}", "name": "Unauthorized Pod", "category": "General Supply",
        "origin": "Base", "destination": "Field"
    })
    assert res.status_code == 403, "Field operator cannot create cargo"

    # 4. Cannot create expedition
    res = client.post("/api/expeditions", headers=headers, json={
        "name": "Unauthorized Traverse", "location": "Schirmacher Oasis"
    })
    assert res.status_code == 403, "Field operator cannot create expeditions"

    # 5. Cannot create personnel
    res = client.post("/api/personnel", headers=headers, json={
        "personnel_code": f"PRS-FO-{uuid.uuid4().hex[:6]}", "name": "Unauthorized Crew", "role": "Scientist", "department": "Science & Research"
    })
    assert res.status_code == 403, "Field operator cannot create personnel"

    # 6. Cannot update system settings
    res = client.put("/api/settings", headers=headers, json={"updates": [{"key": "system_name", "value": "Hacked"}]})
    assert res.status_code == 403, "Field operator cannot update system settings"


def test_field_operator_allowed_operational_updates():
    headers = auth_headers("field")

    # Field operator CAN record cargo movement
    res = client.post("/api/cargo/1/movement", headers=headers, json={
        "status": "In Transit", "location": "Schirmacher Oasis WP-4", "notes": "Field pass"
    })
    assert res.status_code in [200, 201], f"Field operator should record cargo movement: {res.text}"

    # Field operator CAN update personnel location
    res = client.post("/api/personnel/1/location", headers=headers, json={
        "location_name": "Traverse Route B", "latitude": -70.75, "longitude": 11.75,
        "movement_type": "FIELD_MOVEMENT", "status": "FIELD"
    })
    assert res.status_code in [200, 201], f"Field operator should update personnel location: {res.text}"


# ==============================================================================
# 5. SAR, LOGISTICS & EXPEDITION LEADER PERMISSIONS PRESERVED
# ==============================================================================
def test_sar_officer_lifecycle_authority():
    sar_headers = auth_headers("sar")

    # SAR officer CAN report incident
    res = client.post("/api/incidents", headers=sar_headers, json={
        "title": "Glacier Crevasse Warning",
        "incident_type": "MEDICAL",
        "severity": "HIGH",
        "reported_by": "SAR Officer Vikramaditya",
        "location_name": "Maitri Glacier Margin"
    })
    assert res.status_code == 201, f"SAR can report incident: {res.text}"
    inc_id = res.json()["id"]

    # SAR officer CAN acknowledge incident
    res = client.post(f"/api/incidents/{inc_id}/acknowledge", headers=sar_headers, json={"actor": "SAR Lead"})
    assert res.status_code == 200, "SAR officer can acknowledge incident"

    # SAR officer CAN triage incident
    res = client.post(f"/api/incidents/{inc_id}/triage", headers=sar_headers, json={"severity": "CRITICAL", "actor": "SAR Lead"})
    assert res.status_code == 200, "SAR officer can triage incident"

    # SAR officer CANNOT create cargo (restricted)
    res = client.post("/api/cargo", headers=sar_headers, json={
        "cargo_code": f"CRG-SAR-{uuid.uuid4().hex[:6]}", "name": "SAR Cargo", "origin": "A", "destination": "B"
    })
    assert res.status_code == 403, "SAR officer cannot create cargo"


def test_logistics_officer_authority():
    log_headers = auth_headers("logistics")
    uniq_code = uuid.uuid4().hex[:6]

    # Logistics officer CAN create cargo
    res = client.post("/api/cargo", headers=log_headers, json={
        "cargo_code": f"CRG-LOG-{uniq_code}",
        "name": "Supply Depot Batteries",
        "category": "Power Equipment",
        "origin": "Goa Port",
        "destination": "Maitri Station"
    })
    assert res.status_code == 201, f"Logistics officer should create cargo: {res.text}"

    # Logistics officer CAN create inventory item
    res = client.post("/api/inventory", headers=log_headers, json={
        "item_code": f"LOG-INV-{uniq_code}",
        "item_name": "Arctic Lubricant Oil",
        "category": "Other",
        "quantity": 100,
        "minimum_quantity": 20,
        "unit": "Liters"
    })
    assert res.status_code == 201, f"Logistics officer should create inventory item: {res.text}"

    # Logistics officer CANNOT create expeditions
    res = client.post("/api/expeditions", headers=log_headers, json={
        "name": "Logistics Mission", "location": "Coast"
    })
    assert res.status_code == 403, "Logistics officer cannot create expeditions"


def test_expedition_leader_authority():
    ldr_headers = auth_headers("leader")
    uniq_code = uuid.uuid4().hex[:6]

    # Leader CAN create personnel
    res = client.post("/api/personnel", headers=ldr_headers, json={
        "personnel_code": f"PRS-LDR-{uniq_code}",
        "name": "Rohan Sharma",
        "role": "Scientist",
        "department": "Science & Research"
    })
    assert res.status_code == 201, f"Expedition leader should create personnel: {res.text}"

    # Leader CANNOT perform inventory stock operations
    res = client.post("/api/inventory/1/stock", headers=ldr_headers, json={
        "transaction_type": "ADJUSTMENT", "quantity": 10
    })
    assert res.status_code == 403, "Expedition leader cannot perform stock ops"
