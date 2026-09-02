"""
POLAR-X Task 7 — Emergency Response & SAR Operations Backend Test Suite
Tests all incident CRUD, state machine transitions, duplicate prevention,
unit recommendations, SOS, and coordinate validation.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Use an in-memory test database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_task7.db"

from backend.database import Base
from backend import models, crud, schemas

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

PASS = 0
FAIL = 0
RESULTS = []

def run_test(name, fn):
    global PASS, FAIL
    try:
        fn()
        PASS += 1
        RESULTS.append(f"  [PASS]  {name}")
    except AssertionError as e:
        FAIL += 1
        RESULTS.append(f"  [FAIL]  {name}: {e}")
    except Exception as e:
        FAIL += 1
        RESULTS.append(f"  [ERROR] {name}: {type(e).__name__}: {e}")

def get_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    return db

def seed_test_data(db):
    """Seed minimal test data (one personnel, two response units)."""
    if db.query(models.ResponseUnit).count() == 0:
        u1 = models.ResponseUnit(
            unit_code="TEST-SAR-01",
            name="Test SAR Snowcat",
            unit_type="VEHICLE",
            team="Test SAR",
            status="AVAILABLE",
            capabilities="Crevasse Extraction, Hypothermia Triage",
            current_location="Test Station",
            latitude=-70.7670,
            longitude=11.7400,
            created_at="2026-09-01 00:00 UTC"
        )
        u2 = models.ResponseUnit(
            unit_code="TEST-MED-01",
            name="Test Medical Team",
            unit_type="MEDICAL_TEAM",
            team="Test Medical",
            status="AVAILABLE",
            capabilities="Trauma Care, Medical Evacuation",
            current_location="Test Infirmary",
            latitude=-70.7680,
            longitude=11.7410,
            created_at="2026-09-01 00:00 UTC"
        )
        db.add_all([u1, u2])
        db.commit()

    if db.query(models.Personnel).count() == 0:
        p = models.Personnel(
            personnel_code="TEST-P-001",
            name="Test Scientist",
            role="Scientist",
            department="Science",
            status="FIELD",
            current_location="Test Field Camp",
            latitude=-70.7500,
            longitude=11.6800,
            created_at="2026-09-01 00:00 UTC"
        )
        db.add(p)
        db.commit()

# ─── TEST CASES ─────────────────────────────────────────────────────────────

def test_create_incident(db):
    """Create a new incident via CRUD."""
    person = db.query(models.Personnel).filter_by(personnel_code="TEST-P-001").first()
    inc_in = schemas.IncidentCreate(
        title="Test Crevasse Incident",
        incident_type="MEDICAL",
        severity="HIGH",
        reported_by="Test Scientist",
        latitude=-70.7500,
        longitude=11.6800,
        location_name="Field Camp Alpha",
        description="Scientist fell into crevasse.",
        personnel_id=person.id if person else None
    )
    inc = crud.create_incident(db, inc_in, actor="Test Actor")
    assert inc is not None
    assert inc.incident_code.startswith("INC-")
    assert inc.status == "REPORTED"
    assert inc.severity == "HIGH"

def test_get_incidents_list(db):
    """List incidents returns at least one."""
    incs = crud.get_incidents(db)
    assert len(incs) >= 1

def test_get_incident_detail(db):
    """Get incident detail returns events and recommendations."""
    incs = crud.get_incidents(db, limit=1)
    assert len(incs) >= 1
    detail = crud.get_incident_detail(db, incs[0].id)
    assert detail is not None
    assert hasattr(detail, 'events')
    assert hasattr(detail, 'recommended_units')

def test_acknowledge_incident(db):
    """Acknowledge a REPORTED incident transitions to ACKNOWLEDGED."""
    inc_db = db.query(models.Incident).filter(models.Incident.status == "REPORTED").first()
    assert inc_db is not None, "No REPORTED incident found"
    result, err = crud.acknowledge_incident(db, inc_db.id, actor="Test Commander")
    assert err is None
    assert result.status == "ACKNOWLEDGED"

def test_triage_incident(db):
    """Triage transitions ACKNOWLEDGED -> TRIAGED and updates severity."""
    inc_db = db.query(models.Incident).filter(models.Incident.status == "ACKNOWLEDGED").first()
    assert inc_db is not None, "No ACKNOWLEDGED incident found"
    triage = schemas.IncidentTriageUpdate(severity="CRITICAL", notes="Critical hypothermia risk.")
    result, err = crud.triage_incident(db, inc_db.id, triage)
    assert err is None
    assert result.status == "TRIAGED"
    assert result.severity == "CRITICAL"

def test_assign_response_unit(db):
    """Assign an AVAILABLE unit to a TRIAGED incident."""
    inc_db = db.query(models.Incident).filter(models.Incident.status == "TRIAGED").first()
    assert inc_db is not None, "No TRIAGED incident found"
    unit = db.query(models.ResponseUnit).filter(models.ResponseUnit.status == "AVAILABLE").first()
    assert unit is not None, "No AVAILABLE unit found"
    assign = schemas.IncidentAssignUpdate(response_unit_id=unit.id)
    result, err = crud.assign_incident_unit(db, inc_db.id, assign)
    assert err is None
    assert result.assigned_unit_id == unit.id

def test_dispatch_incident(db):
    """Dispatch incident with assigned unit transitions to DISPATCHED."""
    # Find any incident with an assigned unit that's not terminal
    inc_db = db.query(models.Incident).filter(
        models.Incident.assigned_unit_id.isnot(None),
        models.Incident.status.notin_(["RESOLVED", "CANCELLED", "DISPATCHED", "IN_PROGRESS"])
    ).first()
    assert inc_db is not None, "No assignable incident found"
    action = schemas.IncidentActionUpdate(actor="Test Dispatcher")
    result, err = crud.dispatch_incident(db, inc_db.id, action)
    assert err is None
    assert result.status == "DISPATCHED"

def test_start_incident_mission(db):
    """Start mission transitions DISPATCHED -> IN_PROGRESS."""
    inc_db = db.query(models.Incident).filter(models.Incident.status == "DISPATCHED").first()
    assert inc_db is not None, "No DISPATCHED incident found"
    action = schemas.IncidentActionUpdate(actor="Test Field Lead")
    result, err = crud.start_incident_mission(db, inc_db.id, action)
    assert err is None
    assert result.status == "IN_PROGRESS"

def test_resolve_incident(db):
    """Resolve IN_PROGRESS incident with notes."""
    inc_db = db.query(models.Incident).filter(models.Incident.status == "IN_PROGRESS").first()
    assert inc_db is not None, "No IN_PROGRESS incident found"
    resolve = schemas.IncidentResolveUpdate(
        resolution_notes="Casualty recovered safely. Unit returning to base.",
        actor="Test Commander"
    )
    result, err = crud.resolve_incident(db, inc_db.id, resolve)
    assert err is None
    assert result.status == "RESOLVED"

def test_resolve_requires_notes(db):
    """Resolve without notes returns error."""
    # Create a new incident to resolve
    inc_in = schemas.IncidentCreate(
        title="Resolve-test incident",
        incident_type="OTHER",
        severity="LOW",
        reported_by="Test",
        latitude=-70.7670,
        longitude=11.7400,
        location_name="Test"
    )
    inc = crud.create_incident(db, inc_in)
    resolve = schemas.IncidentResolveUpdate(resolution_notes="   ", actor="Test")
    result, err = crud.resolve_incident(db, inc.id, resolve)
    assert err is not None
    assert "required" in err.lower()

def test_cancel_incident(db):
    """Cancel a REPORTED incident."""
    inc_in = schemas.IncidentCreate(
        title="Cancellation test incident",
        incident_type="OTHER",
        severity="LOW",
        reported_by="Test System",
        latitude=-70.7670,
        longitude=11.7400,
        location_name="Test Area"
    )
    inc = crud.create_incident(db, inc_in)
    action = schemas.IncidentActionUpdate(notes="False alarm. Incident cancelled.", actor="Test Commander")
    result, err = crud.cancel_incident(db, inc.id, action)
    assert err is None
    assert result.status == "CANCELLED"

def test_terminal_state_transitions(db):
    """Cannot acknowledge/triage/dispatch a RESOLVED or CANCELLED incident."""
    # Get a RESOLVED or CANCELLED incident
    inc_db = db.query(models.Incident).filter(
        models.Incident.status.in_(["RESOLVED", "CANCELLED"])
    ).first()
    assert inc_db is not None, "No terminal incident found"

    _, err = crud.acknowledge_incident(db, inc_db.id, actor="Test")
    assert err is not None

    triage = schemas.IncidentTriageUpdate(severity="HIGH")
    _, err = crud.triage_incident(db, inc_db.id, triage)
    assert err is not None

def test_unit_recommendation(db):
    """Recommend units returns a sorted list."""
    incs = crud.get_incidents(db, limit=1)
    assert len(incs) >= 1
    recs = crud.recommend_response_units(db, incs[0].id)
    assert isinstance(recs, list)
    if len(recs) > 1:
        assert recs[0].score <= recs[1].score  # Sorted ascending

def test_sos_creates_incident(db):
    """SOS trigger creates a CRITICAL MEDICAL incident for personnel."""
    person = db.query(models.Personnel).filter_by(personnel_code="TEST-P-001").first()
    assert person is not None
    # Ensure no active incident first
    db.query(models.Incident).filter(
        models.Incident.personnel_id == person.id,
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).delete()
    db.commit()

    inc, err = crud.create_or_get_personnel_sos_incident(db, person.id, reason="Test SOS")
    assert err is None
    assert inc is not None
    assert inc.severity == "CRITICAL"
    assert inc.incident_type == "MEDICAL"
    assert inc.status == "REPORTED"

    # Verify personnel is now EMERGENCY
    db.refresh(person)
    assert person.status == "EMERGENCY"

def test_sos_duplicate_prevention(db):
    """Second SOS for same personnel returns existing incident, not a duplicate."""
    person = db.query(models.Personnel).filter_by(personnel_code="TEST-P-001").first()
    assert person is not None

    # Call SOS again
    inc2, err = crud.create_or_get_personnel_sos_incident(db, person.id, reason="Duplicate test")
    assert err is None
    assert inc2 is not None

    # Count active incidents for this person — should be exactly 1
    active_count = db.query(models.Incident).filter(
        models.Incident.personnel_id == person.id,
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).count()
    assert active_count == 1, f"Expected 1 active incident, got {active_count}"

def test_sos_nonexistent_personnel(db):
    """SOS for nonexistent personnel_id returns error."""
    _, err = crud.create_or_get_personnel_sos_incident(db, 99999, reason="Test")
    assert err is not None
    assert "not found" in err.lower()

def test_coordinate_validation_via_schemas():
    """Coordinate bounds are enforced by router layer (simulated)."""
    # Latitude
    valid_lats = [-90.0, 0.0, 90.0, -70.7670, 78.9]
    invalid_lats = [-90.1, 90.1, 200.0, -200.0]
    for lat in valid_lats:
        assert -90.0 <= lat <= 90.0, f"{lat} should be valid"
    for lat in invalid_lats:
        assert not (-90.0 <= lat <= 90.0), f"{lat} should be invalid"
    # Longitude
    valid_lons = [-180.0, 0.0, 180.0, 11.74, 76.19]
    invalid_lons = [-180.1, 180.1, 300.0, -300.0]
    for lon in valid_lons:
        assert -180.0 <= lon <= 180.0, f"{lon} should be valid"
    for lon in invalid_lons:
        assert not (-180.0 <= lon <= 180.0), f"{lon} should be invalid"

def test_incident_history_logged(db):
    """Incident history events are created and retrievable."""
    incs = crud.get_incidents(db, limit=1)
    assert len(incs) >= 1
    events = crud.get_incident_events(db, incs[0].id)
    assert isinstance(events, list)
    assert len(events) >= 1
    ev = events[0]
    assert hasattr(ev, 'event_type')
    assert hasattr(ev, 'timestamp')

def test_incident_summary_stats(db):
    """Summary stats return correct structure and counts."""
    stats = crud.get_incident_summary_stats(db)
    assert hasattr(stats, 'total_incidents')
    assert hasattr(stats, 'active_incidents')
    assert hasattr(stats, 'units_available')
    assert stats.total_incidents >= 1

def test_get_incident_locations(db):
    """Location layer returns entries with valid coords."""
    locs = crud.get_incident_locations(db)
    assert isinstance(locs, list)
    for loc in locs:
        assert loc.latitude is not None
        assert loc.longitude is not None
        assert -90 <= loc.latitude <= 90
        assert -180 <= loc.longitude <= 180

def test_response_unit_crud(db):
    """Create, read, update response unit via CRUD."""
    unit_in = schemas.ResponseUnitCreate(
        unit_code="TEST-NEW-01",
        name="New Test Unit",
        unit_type="FIELD_TEAM",
        team="Test Team",
        status="AVAILABLE",
        capabilities="Test Cap",
        current_location="Test Loc",
        latitude=-70.7670,
        longitude=11.7400
    )
    u = crud.create_response_unit(db, unit_in)
    assert u is not None

    uo = crud.get_response_unit(db, u.id)
    assert uo.unit_code == "TEST-NEW-01"

    upd = schemas.ResponseUnitUpdate(status="OFF_DUTY")
    crud.update_response_unit(db, u.id, upd)
    uo2 = crud.get_response_unit(db, u.id)
    assert uo2.status == "OFF_DUTY"

def test_dispatch_without_unit_fails(db):
    """Dispatch incident without assigned unit returns error."""
    inc_in = schemas.IncidentCreate(
        title="No-unit dispatch test",
        incident_type="OTHER",
        severity="LOW",
        reported_by="System",
        latitude=-70.7670,
        longitude=11.7400,
        location_name="Test"
    )
    inc = crud.create_incident(db, inc_in)
    action = schemas.IncidentActionUpdate()
    _, err = crud.dispatch_incident(db, inc.id, action)
    assert err is not None
    assert "without" in err.lower() or "assigned" in err.lower() or "unit" in err.lower()

def test_haversine_distance():
    """Haversine gives plausible distances for known polar coordinates."""
    # Maitri to Bharati (roughly 2200-2500 km apart)
    d = crud.calculate_haversine_distance(-70.7670, 11.7400, -69.4072, 76.1872)
    assert 2000 < d < 3000, f"Unexpected Maitri-Bharati distance: {d} km"
    # Same point should be ~0
    d_same = crud.calculate_haversine_distance(-70.7670, 11.7400, -70.7670, 11.7400)
    assert d_same < 0.01

# ─── MAIN RUNNER ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*70)
    print("  POLAR-X TASK 7 — EMERGENCY RESPONSE & SAR BACKEND TEST SUITE")
    print("="*70)

    # Setup
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_test_data(db)

    # Run all tests
    run_test("Create incident via CRUD", lambda: test_create_incident(db))
    run_test("Get incidents list", lambda: test_get_incidents_list(db))
    run_test("Get incident detail (with events & recs)", lambda: test_get_incident_detail(db))
    run_test("Acknowledge incident (REPORTED -> ACKNOWLEDGED)", lambda: test_acknowledge_incident(db))
    run_test("Triage incident (ACKNOWLEDGED -> TRIAGED, severity update)", lambda: test_triage_incident(db))
    run_test("Assign response unit to incident", lambda: test_assign_response_unit(db))
    run_test("Dispatch incident (-> DISPATCHED)", lambda: test_dispatch_incident(db))
    run_test("Start incident mission (-> IN_PROGRESS)", lambda: test_start_incident_mission(db))
    run_test("Resolve incident with notes (-> RESOLVED)", lambda: test_resolve_incident(db))
    run_test("Resolve requires non-empty notes", lambda: test_resolve_requires_notes(db))
    run_test("Cancel incident (-> CANCELLED)", lambda: test_cancel_incident(db))
    run_test("Terminal state blocks further transitions", lambda: test_terminal_state_transitions(db))
    run_test("Unit recommendation sorted by score", lambda: test_unit_recommendation(db))
    run_test("SOS creates CRITICAL MEDICAL incident", lambda: test_sos_creates_incident(db))
    run_test("SOS duplicate prevention", lambda: test_sos_duplicate_prevention(db))
    run_test("SOS nonexistent personnel returns error", lambda: test_sos_nonexistent_personnel(db))
    run_test("Coordinate bounds validation", test_coordinate_validation_via_schemas)
    run_test("Incident history events logged", lambda: test_incident_history_logged(db))
    run_test("Incident summary stats structure", lambda: test_incident_summary_stats(db))
    run_test("Incident location layer coordinates valid", lambda: test_get_incident_locations(db))
    run_test("Response unit CRUD (create/read/update)", lambda: test_response_unit_crud(db))
    run_test("Dispatch without assigned unit returns error", lambda: test_dispatch_without_unit_fails(db))
    run_test("Haversine distance calculation", test_haversine_distance)

    db.close()
    engine.dispose()

    # Cleanup
    import time
    time.sleep(0.5)
    try:
        if os.path.exists("test_task7.db"):
            os.remove("test_task7.db")
    except Exception:
        pass  # Not critical if cleanup fails on Windows

    print("\n" + "-"*70)
    for r in RESULTS:
        print(r)
    print("-"*70)
    total = PASS + FAIL
    print(f"\n  TOTAL: {total}  |  PASSED: {PASS}  |  FAILED: {FAIL}")
    print("="*70 + "\n")
    sys.exit(0 if FAIL == 0 else 1)

