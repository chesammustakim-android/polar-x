"""
POLAR-X PASS 1 VERIFICATION TEST SUITE
Tests Station Resource Requirements, Daily Consumption Registry, Station Management, and STATION_HEAD RBAC.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend import models, crud

client = TestClient(app)

def run_tests():
    print("\n" + "="*70)
    print("  POLAR-X PASS 1: INVENTORY + STATION MANAGEMENT + RBAC TEST SUITE")
    print("="*70 + "\n")

    passed = 0
    failed = 0

    def record_result(name, ok, reason=""):
        nonlocal passed, failed
        if ok:
            passed += 1
            print(f"  [PASS]  {name}")
        else:
            failed += 1
            print(f"  [FAIL]  {name}: {reason}")

    # 1. Existing admin login still works
    res = client.post("/api/auth/login", json={"username": "admin", "password": "Polar@2026"})
    admin_token = res.json().get("access_token") if res.status_code == 200 else None
    record_result("1. Existing admin login works", res.status_code == 200 and bool(admin_token))

    # 2. Existing director login still works
    res = client.post("/api/auth/login", json={"username": "director", "password": "Polar@2026"})
    director_token = res.json().get("access_token") if res.status_code == 200 else None
    record_result("2. Existing director login works", res.status_code == 200 and bool(director_token))

    # 3. New Station Head login works
    res = client.post("/api/auth/login", json={"username": "head.maitri", "password": "Polar@2026"})
    head_token = res.json().get("access_token") if res.status_code == 200 else None
    head_user = res.json().get("user") if res.status_code == 200 else {}
    record_result("3. New Station Head login works", res.status_code == 200 and bool(head_token))

    # 4. Station Head is associated with one station
    maitri_station_id = head_user.get("assigned_station_id")
    record_result(
        "4. Station Head is associated with one assigned station",
        maitri_station_id is not None and maitri_station_id > 0,
        f"assigned_station_id is {maitri_station_id}"
    )

    # Find a different station for testing isolation
    db = SessionLocal()
    himadri = db.query(models.Station).filter(models.Station.name.ilike("%Himadri%")).first()
    himadri_station_id = himadri.id if himadri else 3
    db.close()

    # 5. Station Head cannot access another station's scoped data
    head_headers = {"Authorization": f"Bearer {head_token}"}
    res = client.get(f"/api/stations/{himadri_station_id}/requirements", headers=head_headers)
    record_result(
        "5. Station Head cannot access another station's scoped requirements (HTTP 403)",
        res.status_code == 403,
        f"Got status {res.status_code}"
    )

    # 6. Station Head cannot add/edit/deactivate stations
    res = client.post("/api/stations", json={"name": "Rogue Base", "latitude": -70.0, "longitude": 10.0}, headers=head_headers)
    res_edit = client.put(f"/api/stations/{maitri_station_id}", json={"name": "Hacked Name"}, headers=head_headers)
    res_deact = client.patch(f"/api/stations/{maitri_station_id}/deactivate", headers=head_headers)
    record_result(
        "6. Station Head cannot add, edit, or deactivate stations (HTTP 403)",
        res.status_code == 403 and res_edit.status_code == 403 and res_deact.status_code == 403,
        f"Create: {res.status_code}, Edit: {res_edit.status_code}, Deactivate: {res_deact.status_code}"
    )

    # 7. Director can add a station
    dir_headers = {"Authorization": f"Bearer {director_token}"}
    test_st_name = "Test Glacier Research Outpost"
    # Clean up if existed from previous run
    db = SessionLocal()
    existing_st = db.query(models.Station).filter(models.Station.name == test_st_name).first()
    if existing_st:
        db.query(models.StationResourceRequirement).filter(models.StationResourceRequirement.station_id == existing_st.id).delete()
        db.query(models.DailyConsumptionRecord).filter(models.DailyConsumptionRecord.station_id == existing_st.id).delete()
        db.delete(existing_st)
        db.commit()
    db.close()

    res = client.post(
        "/api/stations",
        json={
            "name": test_st_name,
            "type": "Field Outpost",
            "latitude": -71.2500,
            "longitude": 12.4500,
            "elevation": "250m ASL",
            "region": "Antarctica - Queen Maud Land",
            "description": "Glaciology outpost deployed for ice-core sampling."
        },
        headers=dir_headers
    )
    created_st_id = res.json().get("id") if res.status_code == 201 else None
    record_result("7. Director can add a station", res.status_code == 201 and created_st_id is not None, f"Status: {res.status_code}")

    # 8. Director can edit a station
    res = client.put(
        f"/api/stations/{created_st_id}",
        json={"description": "Updated scientific description.", "elevation": "280m ASL"},
        headers=dir_headers
    )
    record_result(
        "8. Director can edit a station",
        res.status_code == 200 and res.json().get("elevation") == "280m ASL",
        f"Status: {res.status_code}"
    )

    # 9. Director can deactivate/reactivate a station
    res_deact = client.patch(f"/api/stations/{created_st_id}/deactivate", headers=dir_headers)
    res_react = client.patch(f"/api/stations/{created_st_id}/reactivate", headers=dir_headers)
    record_result(
        "9. Director can deactivate/reactivate a station",
        res_deact.status_code == 200 and res_deact.json().get("status") == "INACTIVE" and
        res_react.status_code == 200 and res_react.json().get("status") == "OPERATIONAL",
        f"Deact: {res_deact.status_code}, React: {res_react.status_code}"
    )

    # 10. Director can create a station resource requirement
    res = client.post(
        f"/api/stations/{created_st_id}/requirements",
        json={
            "item_code": "FUEL-001",
            "minimum_quantity": 5000.0,
            "unit": "Litres",
            "item_name": "Arctic Aviation Fuel (Jet A-1)"
        },
        headers=dir_headers
    )
    created_req_id = res.json().get("id") if res.status_code == 201 else None
    record_result("10. Director can create a station resource requirement", res.status_code == 201 and created_req_id is not None, f"Status: {res.status_code}")

    # 11. Director can update that requirement
    res = client.put(
        f"/api/stations/{created_st_id}/requirements/{created_req_id}",
        json={"minimum_quantity": 6500.0},
        headers=dir_headers
    )
    record_result(
        "11. Director can update that requirement",
        res.status_code == 200 and res.json().get("minimum_quantity") == 6500.0,
        f"Status: {res.status_code}"
    )

    # 12. Station Head can view assigned station requirement
    res = client.get(f"/api/stations/{maitri_station_id}/requirements", headers=head_headers)
    record_result(
        "12. Station Head can view assigned station requirements",
        res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0,
        f"Status: {res.status_code}, list size: {len(res.json()) if isinstance(res.json(), list) else 0}"
    )

    # 13. Station Head can create a daily consumption record for assigned station
    test_date = "2026-09-10"
    # Clean up test consumption record if existing
    db = SessionLocal()
    existing_c = db.query(models.DailyConsumptionRecord).filter(
        models.DailyConsumptionRecord.station_id == maitri_station_id,
        models.DailyConsumptionRecord.item_code == "FUEL-001",
        models.DailyConsumptionRecord.consumption_date == test_date
    ).first()
    if existing_c:
        db.delete(existing_c)
        db.commit()
    db.close()

    res = client.post(
        f"/api/stations/{maitri_station_id}/consumption",
        json={
            "item_code": "FUEL-001",
            "consumption_date": test_date,
            "consumed_quantity": 145.0,
            "unit": "Litres",
            "notes": "Daily heating generator draw."
        },
        headers=head_headers
    )
    record_result(
        "13. Station Head can create daily consumption record for assigned station",
        res.status_code == 201 and res.json().get("consumed_quantity") == 145.0,
        f"Status: {res.status_code}"
    )

    # 14. Station Head cannot create consumption for another station
    res = client.post(
        f"/api/stations/{himadri_station_id}/consumption",
        json={
            "item_code": "FUEL-003",
            "consumption_date": test_date,
            "consumed_quantity": 50.0,
            "unit": "Litres"
        },
        headers=head_headers
    )
    record_result(
        "14. Station Head cannot create consumption for another station (HTTP 403)",
        res.status_code == 403,
        f"Status: {res.status_code}"
    )

    # 15. Consumption history can be retrieved
    res = client.get(f"/api/stations/{maitri_station_id}/consumption", headers=head_headers)
    record_result(
        "15. Consumption history can be retrieved",
        res.status_code == 200 and len(res.json()) > 0 and res.json()[0]["consumed_quantity"] == 145.0,
        f"Status: {res.status_code}, entries: {len(res.json()) if isinstance(res.json(), list) else 0}"
    )

    # 16. Duplicate / invalid requirement data is rejected
    # Duplicate requirement on same station + resource
    res_dup = client.post(
        f"/api/stations/{created_st_id}/requirements",
        json={"item_code": "FUEL-001", "minimum_quantity": 4000.0},
        headers=dir_headers
    )
    # Negative quantity
    res_neg = client.post(
        f"/api/stations/{created_st_id}/requirements",
        json={"item_code": "FOOD-101", "minimum_quantity": -100.0},
        headers=dir_headers
    )
    record_result(
        "16. Duplicate and negative requirement data rejected with HTTP 400",
        res_dup.status_code == 400 and res_neg.status_code == 400,
        f"Dup: {res_dup.status_code}, Neg: {res_neg.status_code}"
    )

    # 17. Existing inventory APIs still work
    res = client.get("/api/inventory", headers=dir_headers)
    record_result(
        "17. Existing inventory APIs still work",
        res.status_code == 200 and len(res.json()) > 0,
        f"Status: {res.status_code}"
    )

    # 18. Existing Map station markers still work
    res = client.get("/api/stations", headers=dir_headers)
    record_result(
        "18. Existing Map station markers still work from /api/stations",
        res.status_code == 200 and len(res.json()) >= 10,
        f"Status: {res.status_code}, count: {len(res.json()) if isinstance(res.json(), list) else 0}"
    )

    # 19. Existing Smart Operations still loads
    res = client.get("/api/automation/expedition-readiness", headers=dir_headers)
    record_result(
        "19. Existing Smart Operations still loads",
        res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0,
        f"Status: {res.status_code}"
    )

    print("\n" + "-"*70)
    print(f"  TOTAL: {passed + failed}  |  PASSED: {passed}  |  FAILED: {failed}")
    print("="*70 + "\n")

    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
