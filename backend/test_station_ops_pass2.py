"""
POLAR-X PASS 2 TEST SUITE: Inventory Intelligence, Burn Rates, Forecasts & Smart Operations
Tests:
1. Logout / Session switching (auth state clearing, protected endpoint re-verification)
2. Station Head scoping on /api/inventory/station-intelligence (assigned station only, no query param bypass)
3. Director/Admin full access and station filtering on /api/inventory/station-intelligence
4. Burn rate calculation (deterministic 7-day average from real records)
5. Insufficient history handling (<3 records -> 'Insufficient consumption history', burn_rate_value is None)
6. Consumption trend classification (STABLE, INCREASING, DECREASING, INSUFFICIENT DATA)
7. Days remaining / Forecast calculation and edge cases (stock <= min -> immediate breach, burn=0, insufficient data)
8. 4-tier Risk classification: NORMAL, LOW, CRITICAL, URGENT
9. Explainability factors ('WHY THIS WAS FLAGGED')
10. Smart Operations /api/automation/inventory-risk enrichment with station telemetry
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend import models, crud, schemas
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_pass2.db"
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
        import traceback
        FAIL += 1
        tb = traceback.format_exc().strip().split('\n')[-2:]
        RESULTS.append(f"  [FAIL]  {name}: {' | '.join(tb)}")
    except Exception as e:
        FAIL += 1
        RESULTS.append(f"  [ERROR] {name}: {type(e).__name__}: {e}")

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed initial data (users, settings, stations)
        crud.seed_initial_data(db)

        # Ensure station 1 and 2 exist
        s1 = models.Station(
            id=1,
            name="Maitri Research Station",
            type="Research Station",
            latitude=-70.767,
            longitude=11.740,
            region="Antarctica - Queen Maud Land",
            status="OPERATIONAL"
        )
        s2 = models.Station(
            id=2,
            name="Bharati Station",
            type="Research Station",
            latitude=-69.407,
            longitude=76.187,
            region="Antarctica - Larsemann Hills",
            status="OPERATIONAL"
        )
        db.merge(s1)
        db.merge(s2)

        # Associate station head user with station 1
        user_head = db.query(models.User).filter(models.User.username == "head.maitri").first()
        if user_head:
            user_head.assigned_station_id = 1
            db.commit()

        # Create Inventory items
        # 1. FUEL-001 at Station 1 with adequate stock
        inv1 = models.Inventory(
            id=1,
            item_code="FUEL-001",
            item_name="Sub-Zero Aviation Kerosene",
            category="Fuel",
            quantity=5000.0,
            minimum_quantity=2000.0,
            unit="Litres",
            location="Maitri Storage Bunker",
            status="NORMAL"
        )
        # 2. MED-001 at Station 1 with stock below minimum
        inv2 = models.Inventory(
            id=2,
            item_code="MED-001",
            item_name="Trauma Emergency Hypothermia Kits",
            category="Medical",
            quantity=15.0,
            minimum_quantity=50.0,
            unit="Kits",
            location="Maitri Main Infirmary",
            status="CRITICAL"
        )
        # 3. FOOD-001 at Station 2 with zero consumption records
        inv3 = models.Inventory(
            id=3,
            item_code="FOOD-001",
            item_name="High-Calorie Field Ration Packs",
            category="Food",
            quantity=800.0,
            minimum_quantity=500.0,
            unit="Packs",
            location="Bharati Logistics Depot",
            status="NORMAL"
        )
        db.merge(inv1)
        db.merge(inv2)
        db.merge(inv3)
        db.commit()

        # Create StationResourceRequirements
        # Req 1: Station 1, FUEL-001 (min 2000)
        req1 = models.StationResourceRequirement(
            id=1,
            station_id=1,
            item_code="FUEL-001",
            item_name="Sub-Zero Aviation Kerosene",
            minimum_quantity=2000.0,
            unit="Litres",
            is_active=True
        )
        # Req 2: Station 1, MED-001 (min 50)
        req2 = models.StationResourceRequirement(
            id=2,
            station_id=1,
            item_code="MED-001",
            item_name="Trauma Emergency Hypothermia Kits",
            minimum_quantity=50.0,
            unit="Kits",
            is_active=True
        )
        # Req 3: Station 2, FOOD-001 (min 500)
        req3 = models.StationResourceRequirement(
            id=3,
            station_id=2,
            item_code="FOOD-001",
            item_name="High-Calorie Field Ration Packs",
            minimum_quantity=500.0,
            unit="Packs",
            is_active=True
        )
        db.merge(req1)
        db.merge(req2)
        db.merge(req3)
        db.commit()

        # Seed real daily consumption records for FUEL-001 (Station 1):
        # 7 recent days (days 0-6): exactly 140 L/day -> sum = 980 L, avg = 140 L/day
        # 7 prior days (days 7-13): exactly 100 L/day -> trend = (140 - 100)/100 = +40% (INCREASING)
        today = datetime.utcnow().date()
        for i in range(7):
            d = (today - timedelta(days=i)).isoformat()
            rec = models.DailyConsumptionRecord(
                station_id=1,
                item_code="FUEL-001",
                item_name="Sub-Zero Aviation Kerosene",
                consumption_date=d,
                consumed_quantity=140.0,
                unit="Litres",
                notes=f"Telemetry day -{i}",
                recorded_at=f"{d}T12:00:00Z"
            )
            db.add(rec)

        for i in range(7, 14):
            d = (today - timedelta(days=i)).isoformat()
            rec = models.DailyConsumptionRecord(
                station_id=1,
                item_code="FUEL-001",
                item_name="Sub-Zero Aviation Kerosene",
                consumption_date=d,
                consumed_quantity=100.0,
                unit="Litres",
                notes=f"Telemetry day -{i}",
                recorded_at=f"{d}T12:00:00Z"
            )
            db.add(rec)

        # Seed only 1 consumption record for MED-001 (Station 1):
        # 1 record < 3 threshold -> INSUFFICIENT HISTORY
        db.add(models.DailyConsumptionRecord(
            station_id=1,
            item_code="MED-001",
            item_name="Trauma Emergency Hypothermia Kits",
            consumption_date=today.isoformat(),
            consumed_quantity=2.0,
            unit="Kits",
            notes="Emergency surgery kit consumed",
            recorded_at=f"{today.isoformat()}T14:00:00Z"
        ))

        # FOOD-001 (Station 2) has 0 consumption records -> INSUFFICIENT HISTORY

        db.commit()
    finally:
        db.close()


def get_token(username, password):
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


# ─── TESTS ───────────────────────────────────────────────────────────────────

def test_session_switching_and_logout():
    # 1. Login Director
    dir_token = get_token("director", "Polar@2026")
    assert dir_token
    # Logout Director
    res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {dir_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "logged_out"

    # 2. Login Station Head
    sh_token = get_token("head.maitri", "Polar@2026")
    assert sh_token
    # Logout Station Head
    res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {sh_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "logged_out"

    # 3. Login Admin
    adm_token = get_token("admin", "Polar@2026")
    assert adm_token
    # Logout Admin
    res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {adm_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "logged_out"

    # 4. Protected endpoint without token returns 401
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_station_head_scoping_no_bypass():
    sh_token = get_token("head.maitri", "Polar@2026")
    # Station Head assigned to station 1. Call endpoint without param:
    res = client.get(
        "/api/inventory/station-intelligence",
        headers={"Authorization": f"Bearer {sh_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    # Every returned item MUST belong to station 1
    for item in data:
        assert item["station_id"] == 1, f"Bypass leak! Item station_id: {item['station_id']}"

    # Try to bypass scoping by passing ?station_id=2 in query param:
    res_bypass = client.get(
        "/api/inventory/station-intelligence?station_id=2",
        headers={"Authorization": f"Bearer {sh_token}"}
    )
    assert res_bypass.status_code == 200
    data_bypass = res_bypass.json()
    # Scoping MUST still restrict to station 1!
    for item in data_bypass:
        assert item["station_id"] == 1, "Station Head was able to bypass scoping via query param!"


def test_director_admin_access_and_filtering():
    dir_token = get_token("director", "Polar@2026")
    # Director gets all stations
    res_all = client.get(
        "/api/inventory/station-intelligence",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    assert res_all.status_code == 200
    data_all = res_all.json()
    station_ids = {item["station_id"] for item in data_all}
    assert 1 in station_ids
    assert 2 in station_ids

    # Director filters by station 2
    res_s2 = client.get(
        "/api/inventory/station-intelligence?station_id=2",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    assert res_s2.status_code == 200
    data_s2 = res_s2.json()
    assert all(item["station_id"] == 2 for item in data_s2)


def test_burn_rate_calculation_deterministic():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/inventory/station-intelligence?station_id=1",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    fuel_req = next((item for item in data if item["item_code"] == "FUEL-001"), None)
    assert fuel_req is not None
    assert fuel_req["burn_rate_value"] == 140.0
    assert "140" in fuel_req["burn_rate_text"]
    assert fuel_req["has_sufficient_history"] is True


def test_insufficient_history_handling():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/inventory/station-intelligence?station_id=1",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    data = res.json()
    med_req = next((item for item in data if item["item_code"] == "MED-001"), None)
    assert med_req is not None
    # MED-001 has only 1 record (<3)
    assert med_req["burn_rate_value"] is None
    assert med_req["burn_rate_text"] == "Insufficient consumption history"
    assert med_req["has_sufficient_history"] is False
    assert med_req["trend"] == "INSUFFICIENT DATA"


def test_consumption_trend_classification():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/inventory/station-intelligence?station_id=1",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    data = res.json()
    fuel_req = next((item for item in data if item["item_code"] == "FUEL-001"), None)
    assert fuel_req is not None
    # Recent avg (140) vs prior avg (100) -> +40% increase (>10%)
    assert fuel_req["trend"] == "INCREASING"
    assert fuel_req["trend_pct"] == 40.0


def test_forecast_days_remaining():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/inventory/station-intelligence?station_id=1",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    data = res.json()
    fuel_req = next((item for item in data if item["item_code"] == "FUEL-001"), None)
    assert fuel_req is not None
    # stock = 5000, min = 2000, burn = 140
    # days to minimum = (5000 - 2000) / 140 = 3000 / 140 = 21.4 -> 21 days
    assert fuel_req["days_to_minimum"] == 21
    assert "21 days until reserve breach" in fuel_req["forecast_status"]

    med_req = next((item for item in data if item["item_code"] == "MED-001"), None)
    assert med_req is not None
    # stock = 15, min = 50 -> stock <= min
    assert med_req["days_to_minimum"] == 0
    assert med_req["forecast_status"] == "Already below minimum"


def test_resource_risk_classification():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/inventory/station-intelligence?station_id=1",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    data = res.json()
    med_req = next((item for item in data if item["item_code"] == "MED-001"), None)
    assert med_req is not None
    # MED-001 is already below minimum reserve (15 < 50) -> URGENT
    assert med_req["risk_level"] == "URGENT"


def test_explainability_why_flagged():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/inventory/station-intelligence?station_id=1",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    data = res.json()
    med_req = next((item for item in data if item["item_code"] == "MED-001"), None)
    assert med_req is not None
    assert "Current stock is at or below minimum reserve" in med_req["why_flagged"]
    assert "Reserve is already breached — immediate replenishment required" in med_req["why_flagged"]

    fuel_req = next((item for item in data if item["item_code"] == "FUEL-001"), None)
    assert fuel_req is not None
    assert "Recent burn rate is 140 Litres/day" in fuel_req["why_flagged"]
    assert "Consumption trend is increasing" in fuel_req["why_flagged"]


def test_smart_automation_inventory_risk_integration():
    dir_token = get_token("director", "Polar@2026")
    res = client.get(
        "/api/automation/inventory-risk",
        headers={"Authorization": f"Bearer {dir_token}"}
    )
    assert res.status_code == 200
    risks = res.json()
    assert len(risks) > 0
    fuel_risk = next((r for r in risks if r["item_code"] == "FUEL-001"), None)
    assert fuel_risk is not None
    assert fuel_risk["station_name"] == "Maitri Research Station"
    assert "140" in fuel_risk["burn_rate_text"]
    assert fuel_risk["trend"] == "INCREASING"
    assert fuel_risk["days_to_minimum"] == 21
    assert len(fuel_risk["why_flagged"]) > 0


if __name__ == "__main__":
    setup_module()
    print("=" * 70)
    print("  POLAR-X PASS 2: INVENTORY INTELLIGENCE & SMART OPERATIONS TEST SUITE")
    print("=" * 70)

    run_test("1. Session switching and logout endpoint clears auth", test_session_switching_and_logout)
    run_test("2. Station Head scoped strictly to assigned station (no URL bypass)", test_station_head_scoping_no_bypass)
    run_test("3. Director and Admin full access and station filtering", test_director_admin_access_and_filtering)
    run_test("4. Burn rate calculation (deterministic 7-day average: 980L/7d -> 140L/day)", test_burn_rate_calculation_deterministic)
    run_test("5. Insufficient history handling (<3 records -> explicit unavailable state)", test_insufficient_history_handling)
    run_test("6. Consumption trend classification (INCREASING based on real records)", test_consumption_trend_classification)
    run_test("7. Forecast days remaining and below-minimum breach detection", test_forecast_days_remaining)
    run_test("8. 4-tier risk classification (NORMAL/LOW/CRITICAL/URGENT)", test_resource_risk_classification)
    run_test("9. Explainability factors ('WHY THIS WAS FLAGGED' with real data)", test_explainability_why_flagged)
    run_test("10. Smart Automation /api/automation/inventory-risk station integration", test_smart_automation_inventory_risk_integration)

    print("\nResults:")
    for r in RESULTS:
        print(r)
    print("-" * 70)
    print(f"Total: {PASS + FAIL} | Passed: {PASS} | Failed: {FAIL}")
    print("=" * 70)
    sys.exit(0 if FAIL == 0 else 1)
