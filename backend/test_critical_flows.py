"""
POLAR-X Task 12 — Critical Production Flow Integration Test
Validates the complete end-to-end journey against the running FastAPI production server:
  1. Login (Authentication & JWT Bearer Token)
  2. Dashboard (System KPIs & Real-time Feeds)
  3. Expeditions (Antarctic Missions & Fleet Status)
  4. Cargo (Supply Chain, Cold Storage & Delayed Manifests)
  5. Inventory (Smart Ratios, Critical Stockouts & Runways)
  6. Personnel (Crew Vitals, Deployment Status & Heartbeats)
  7. Map (Stations, Personnel Locations & Cargo Transit Geofences)
  8. Emergency (SAR Incidents, Triage & Response Unit Deployments)
  9. Reports (Cross-Module Analytics & Distribution Metrics)
 10. Automation (Explainable Readiness, Inventory & Logistics Risk Scoring)
 11. Settings (Operational Thresholds, RBAC & Configuration Persistence)
"""

import sys
import urllib.request
import urllib.error
import json

BASE_URL = "http://127.0.0.1:8000"

PASS = 0
FAIL = 0
RESULTS = []

def run_step(step_name, fn):
    global PASS, FAIL
    try:
        fn()
        PASS += 1
        RESULTS.append(f"  [PASS] {step_name}")
    except Exception as e:
        FAIL += 1
        RESULTS.append(f"  [FAIL] {step_name}: {e}")

def http_req(path, method="GET", body=None, headers=None):
    url = f"{BASE_URL}{path}"
    h = headers.copy() if headers else {}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        content = resp.read().decode("utf-8")
        return resp.status, json.loads(content) if content else {}

TOKEN = None

def step_1_login():
    global TOKEN
    status, data = http_req("/api/auth/login", method="POST", body={
        "username": "admin",
        "password": "Polar@2026"
    })
    assert status == 200, f"Expected 200, got {status}"
    assert "access_token" in data, "No access_token returned"
    assert data["user"]["role"] == "ADMIN", f"Expected ADMIN role, got {data['user']['role']}"
    TOKEN = data["access_token"]

def get_auth_headers():
    assert TOKEN is not None, "Login must run first"
    return {"Authorization": f"Bearer {TOKEN}"}

def step_2_dashboard():
    status, data = http_req("/api/dashboard", headers=get_auth_headers())
    assert status == 200, f"Expected 200, got {status}"
    assert "summary" in data, f"Missing summary in dashboard: {list(data.keys())}"
    assert "expeditions" in data, f"Missing expeditions in dashboard: {list(data.keys())}"
    assert "alerts" in data, f"Missing alerts in dashboard: {list(data.keys())}"

def step_3_expeditions():
    status, data = http_req("/api/expeditions", headers=get_auth_headers())
    assert status == 200
    assert isinstance(data, list)
    assert len(data) >= 1

def step_4_cargo():
    status, data = http_req("/api/cargo", headers=get_auth_headers())
    assert status == 200
    assert isinstance(data, list)
    status_stats, stats = http_req("/api/cargo/stats", headers=get_auth_headers())
    assert status_stats == 200, f"Expected 200 from /api/cargo/stats, got {status_stats}"
    assert "total_cargo" in stats, f"Missing total_cargo in stats: {list(stats.keys())}"

def step_5_inventory():
    status, data = http_req("/api/inventory", headers=get_auth_headers())
    assert status == 200
    assert isinstance(data, list)
    status_sum, summary = http_req("/api/inventory/summary", headers=get_auth_headers())
    assert status_sum == 200
    assert "total_items" in summary

def step_6_personnel():
    status, data = http_req("/api/personnel", headers=get_auth_headers())
    assert status == 200
    assert isinstance(data, list)
    status_sum, summary = http_req("/api/personnel/summary", headers=get_auth_headers())
    assert status_sum == 200
    assert "total_personnel" in summary

def step_7_map():
    status_st, stations = http_req("/api/stations", headers=get_auth_headers())
    assert status_st == 200 and len(stations) >= 1
    status_p, pers_locs = http_req("/api/personnel/locations", headers=get_auth_headers())
    assert status_p == 200
    status_c, cargo_locs = http_req("/api/cargo/locations", headers=get_auth_headers())
    assert status_c == 200

def step_8_emergency():
    status_inc, incidents = http_req("/api/incidents", headers=get_auth_headers())
    assert status_inc == 200
    status_act, active = http_req("/api/incidents/active", headers=get_auth_headers())
    assert status_act == 200
    status_u, units = http_req("/api/response-units", headers=get_auth_headers())
    assert status_u == 200

def step_9_reports():
    status, data = http_req("/api/reports/summary", headers=get_auth_headers())
    assert status == 200
    assert "kpis" in data
    status_exp, _ = http_req("/api/reports/expeditions", headers=get_auth_headers())
    assert status_exp == 200
    status_inv, _ = http_req("/api/reports/inventory", headers=get_auth_headers())
    assert status_inv == 200

def step_10_automation():
    status, data = http_req("/api/automation/summary", headers=get_auth_headers())
    assert status == 200
    assert "overall_fleet_readiness" in data
    status_read, _ = http_req("/api/automation/expedition-readiness", headers=get_auth_headers())
    assert status_read == 200
    status_risk, _ = http_req("/api/automation/inventory-risk", headers=get_auth_headers())
    assert status_risk == 200

def step_11_settings():
    status, data = http_req("/api/settings", headers=get_auth_headers())
    assert status == 200
    assert "settings" in data
    assert data["settings"]["system_name"] is not None
    status_def, defaults = http_req("/api/settings/defaults", headers=get_auth_headers())
    assert status_def == 200
    assert defaults["system_name"] == "POLAR-X Command"

def main():
    print("===================================================================")
    print("POLAR-X TASK 12: CRITICAL PRODUCTION FLOW INTEGRATION TEST")
    print("===================================================================")
    run_step("1. Login (POST /api/auth/login)", step_1_login)
    run_step("2. Dashboard (GET /api/dashboard)", step_2_dashboard)
    run_step("3. Expeditions (GET /api/expeditions)", step_3_expeditions)
    run_step("4. Cargo (GET /api/cargo & /stats)", step_4_cargo)
    run_step("5. Inventory (GET /api/inventory & /summary)", step_5_inventory)
    run_step("6. Personnel (GET /api/personnel & /summary)", step_6_personnel)
    run_step("7. Map (GET /api/stations, /locations)", step_7_map)
    run_step("8. Emergency & SAR (GET /api/incidents, /response-units)", step_8_emergency)
    run_step("9. Reports & Analytics (GET /api/reports/summary)", step_9_reports)
    run_step("10. Smart Automation (GET /api/automation/summary)", step_10_automation)
    run_step("11. System Settings (GET /api/settings & /defaults)", step_11_settings)

    print("\nResults:")
    for r in RESULTS:
        print(r)
    print("-------------------------------------------------------------------")
    print(f"Total: {PASS + FAIL} | Passed: {PASS} | Failed: {FAIL}")
    print("===================================================================")
    if FAIL > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
