"""
POLAR-X Task 8 — Reports & Analytics Backend Test Suite
Tests summary metrics aggregation, distribution tallies, deterministic operational
insights, filtered dataset queries, and response models.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_task8.db"

from backend.database import Base
from backend import models, crud, schemas
from backend.routers import reports

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
    crud.seed_initial_data(db)
    return db

# ─── TESTS ───────────────────────────────────────────────────────────────────

def test_summary_kpis():
    db = get_db()
    try:
        res = reports.get_reports_summary(db)
        assert res.kpis is not None, "KPIs missing"
        assert res.kpis.total_expeditions >= 1, "Expected at least 1 expedition"
        assert res.kpis.total_cargo >= 1, "Expected at least 1 cargo item"
        assert res.kpis.total_inventory_items >= 1, "Expected at least 1 inventory item"
        assert res.kpis.total_personnel >= 1, "Expected at least 1 personnel record"
        assert res.kpis.total_incidents >= 1, "Expected at least 1 incident record"
        assert 0 <= res.kpis.average_expedition_readiness <= 100, "Invalid readiness percentage"
    finally:
        db.close()

def test_summary_distributions():
    db = get_db()
    try:
        res = reports.get_reports_summary(db)
        assert isinstance(res.personnel_by_status, dict)
        assert isinstance(res.personnel_by_department, dict)
        assert isinstance(res.cargo_by_status, dict)
        assert isinstance(res.cargo_by_category, dict)
        assert isinstance(res.inventory_by_status, dict)
        assert isinstance(res.inventory_by_category, dict)
        assert isinstance(res.incidents_by_severity, dict)
        assert isinstance(res.incidents_by_type, dict)
        assert isinstance(res.incidents_by_status, dict)
        assert isinstance(res.expeditions_by_status, dict)
    finally:
        db.close()

def test_deterministic_operational_insights():
    db = get_db()
    try:
        res = reports.get_reports_summary(db)
        insights = res.operational_insights
        assert isinstance(insights, list), "Insights should be a list"
        assert len(insights) > 0, "Expected at least 1 operational risk insight from seed data"
        for ins in insights:
            assert ins.id, "Missing insight ID"
            assert ins.type in ["CRITICAL_EMERGENCY", "FIELD_RISK", "SUPPLY_DEFICIT", "DELAYED_CARGO", "LOW_READINESS"]
            assert ins.severity in ["CRITICAL", "HIGH", "MEDIUM", "INFO"]
            assert ins.title, "Missing insight title"
            assert ins.message, "Missing insight message"
    finally:
        db.close()

def test_expeditions_report_and_filter():
    db = get_db()
    try:
        all_exp = reports.get_reports_expeditions(status=None, search=None, db=db)
        assert len(all_exp) >= 1, "Expected expeditions"
        
        filtered = reports.get_reports_expeditions(status="Active", search=None, db=db)
        for e in filtered:
            assert e.status == "Active"

        searched = reports.get_reports_expeditions(status=None, search="Maitri", db=db)
        assert isinstance(searched, list)
    finally:
        db.close()

def test_cargo_report_and_filter():
    db = get_db()
    try:
        all_cargo = reports.get_reports_cargo(expedition_id=None, status=None, category=None, priority=None, search=None, db=db)
        assert len(all_cargo) >= 1, "Expected cargo items"

        filtered_stat = reports.get_reports_cargo(expedition_id=None, status="In Transit", category=None, priority=None, search=None, db=db)
        for c in filtered_stat:
            assert c.status == "In Transit"

        filtered_cat = reports.get_reports_cargo(expedition_id=None, status=None, category="Fuel", priority=None, search=None, db=db)
        for c in filtered_cat:
            assert c.category == "Fuel"
    finally:
        db.close()

def test_inventory_report_and_deficit():
    db = get_db()
    try:
        all_inv = reports.get_reports_inventory(expedition_id=None, category=None, status=None, search=None, db=db)
        assert len(all_inv) >= 1, "Expected inventory items"

        crit_inv = reports.get_reports_inventory(expedition_id=None, category=None, status="CRITICAL", search=None, db=db)
        for i in crit_inv:
            assert i.status == "CRITICAL"
    finally:
        db.close()

def test_personnel_report_and_filter():
    db = get_db()
    try:
        all_p = reports.get_reports_personnel(expedition_id=None, role=None, department=None, status=None, search=None, db=db)
        assert len(all_p) >= 1, "Expected personnel items"

        filtered_dept = reports.get_reports_personnel(expedition_id=None, role=None, department="Science & Research", status=None, search=None, db=db)
        for p in filtered_dept:
            assert p.department == "Science & Research"
    finally:
        db.close()

def test_incidents_report_and_active_filter():
    db = get_db()
    try:
        all_inc = reports.get_reports_incidents(severity=None, status=None, incident_type=None, is_active=None, search=None, db=db)
        assert len(all_inc) >= 1, "Expected incident items"

        active_inc = reports.get_reports_incidents(severity=None, status=None, incident_type=None, is_active=True, search=None, db=db)
        for inc in active_inc:
            assert inc.status not in ["RESOLVED", "CANCELLED"]

        resolved_inc = reports.get_reports_incidents(severity=None, status=None, incident_type=None, is_active=False, search=None, db=db)
        for inc in resolved_inc:
            assert inc.status in ["RESOLVED", "CANCELLED"]
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("POLAR-X Task 8 Backend Reports & Analytics Test Suite")
    print("=" * 60)

    run_test("1. Reports Summary KPIs Aggregate", test_summary_kpis)
    run_test("2. Reports Status Distributions", test_summary_distributions)
    run_test("3. Deterministic Operational Risk Insights", test_deterministic_operational_insights)
    run_test("4. Expeditions Report Query & Filtering", test_expeditions_report_and_filter)
    run_test("5. Cargo Manifest Report Query & Filtering", test_cargo_report_and_filter)
    run_test("6. Inventory Stock Report & Deficits", test_inventory_report_and_deficit)
    run_test("7. Personnel Deployment & Department Filtering", test_personnel_report_and_filter)
    run_test("8. Incident Operations & Active SAR Filtering", test_incidents_report_and_active_filter)

    print("\n" + "\n".join(RESULTS))
    print("=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed out of {PASS + FAIL} tests")
    print("=" * 60)

    # Clean up test db file
    if os.path.exists("test_task8.db"):
        try:
            os.remove("test_task8.db")
        except Exception:
            pass

    if FAIL > 0:
        sys.exit(1)
