"""
POLAR-X Task 11 — System Settings & Operational Configuration Test Suite
Tests:
  1. Default settings seeding and retrieval with proper type casting.
  2. Non-overwriting persistence ("defaults only if missing").
  3. API GET /api/settings access for all authenticated roles.
  4. RBAC: update_settings_put / patch permits ADMIN, and require_roles rejects non-ADMIN.
  5. Settings persistence across requests and re-seeding.
  6. Validation: invalid keys, blank strings, bad boolean values.
  7. Range constraints: warning/critical readiness, inventory ratios, location freshness, report days.
  8. Cross-field validation: readiness warning > critical, inventory low > critical, automation high < critical.
  9. Partial updates cross-checking against active DB settings.
 10. GET /api/settings/defaults endpoint.
 11. Dynamic threshold integration with Task 10 Automation (readiness, inventory risk, cargo risk, automation toggle).
 12. Dynamic inventory stock ratio calculations in crud.py.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

TEST_DB_URL = "sqlite:///./test_task11.db"

# Clean up any leftover test database
if os.path.exists("./test_task11.db"):
    try:
        os.remove("./test_task11.db")
    except Exception:
        pass

from backend.database import Base
from backend import models, crud, schemas
from backend.routers import settings as settings_router
from backend.routers import automation as automation_router
from backend.auth import require_roles

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

def test_1_default_settings_seeding_and_types():
    db = get_db()
    try:
        all_s = crud.get_all_settings(db)
        expected_keys = [
            "system_name", "organization_name", "deployment_environment",
            "readiness_warning_threshold", "readiness_critical_threshold",
            "inventory_low_stock_ratio", "inventory_critical_ratio",
            "location_freshness_hours", "default_report_days",
            "emergency_notifications_enabled", "critical_incident_notifications_enabled",
            "automation_enabled",
            "automation_inventory_risk_high_threshold", "automation_inventory_risk_critical_threshold",
            "automation_cargo_risk_high_threshold", "automation_cargo_risk_critical_threshold"
        ]
        for k in expected_keys:
            assert k in all_s, f"Key '{k}' missing from seeded settings"

        assert isinstance(all_s["system_name"], str)
        assert all_s["system_name"] == "POLAR-X Command"
        assert isinstance(all_s["readiness_warning_threshold"], int)
        assert all_s["readiness_warning_threshold"] == 70
        assert isinstance(all_s["readiness_critical_threshold"], int)
        assert all_s["readiness_critical_threshold"] == 50
        assert isinstance(all_s["inventory_low_stock_ratio"], float)
        assert all_s["inventory_low_stock_ratio"] == 1.5
        assert isinstance(all_s["inventory_critical_ratio"], float)
        assert all_s["inventory_critical_ratio"] == 1.0
        assert isinstance(all_s["location_freshness_hours"], int)
        assert all_s["location_freshness_hours"] == 6
        assert isinstance(all_s["default_report_days"], int)
        assert all_s["default_report_days"] == 30
        assert isinstance(all_s["emergency_notifications_enabled"], bool)
        assert all_s["emergency_notifications_enabled"] is True
        assert isinstance(all_s["automation_enabled"], bool)
        assert all_s["automation_enabled"] is True
    finally:
        db.close()


def test_2_defaults_only_if_missing_persistence():
    db = get_db()
    try:
        # Modify a setting
        row = db.query(models.SystemSetting).filter(models.SystemSetting.key == "system_name").first()
        row.value = "CUSTOM POLAR FLEET"
        db.commit()

        # Re-run seed_initial_data
        crud.seed_initial_data(db)

        # Verify custom value is NOT reverted
        val = crud.get_setting_value(db, "system_name")
        assert val == "CUSTOM POLAR FLEET", f"Expected 'CUSTOM POLAR FLEET', got '{val}'"
    finally:
        db.close()


def test_3_get_settings_router_all_roles():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")
        operator_user = models.User(username="operator", role="FIELD_OPERATOR")

        res_admin = settings_router.get_settings(db=db, current_user=admin_user)
        assert res_admin.settings["readiness_warning_threshold"] == 70
        assert res_admin.items is not None and len(res_admin.items) > 0

        res_op = settings_router.get_settings(db=db, current_user=operator_user)
        assert res_op.settings["readiness_warning_threshold"] == 70
        assert res_op.items is not None and len(res_op.items) > 0
    finally:
        db.close()


def test_4_rbac_require_roles_enforcement():
    admin_user = models.User(username="admin", role="ADMIN")
    operator_user = models.User(username="operator", role="FIELD_OPERATOR")

    check_admin_only = require_roles(["ADMIN"])

    # Admin passes role check
    passed_user = check_admin_only(admin_user)
    assert passed_user.username == "admin"

    # Non-admin rejected with 403 Forbidden
    try:
        check_admin_only(operator_user)
        assert False, "Expected HTTPException 403 for non-admin"
    except HTTPException as e:
        assert e.status_code == 403, f"Expected 403, got {e.status_code}"


def test_5_update_settings_put_and_patch_admin():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")

        # 1. PUT update
        put_payload = schemas.SettingsUpdateRequest(updates=[
            schemas.SettingUpdate(key="system_name", value="POLAR-X Command Antarctic"),
            schemas.SettingUpdate(key="readiness_warning_threshold", value="75"),
            schemas.SettingUpdate(key="readiness_critical_threshold", value="55")
        ])
        updated_items = settings_router.update_settings_put(request=put_payload, db=db, current_user=admin_user)
        assert len(updated_items) == 3

        # Verify through get_settings
        res_get = settings_router.get_settings(db=db, current_user=admin_user)
        assert res_get.settings["system_name"] == "POLAR-X Command Antarctic"
        assert res_get.settings["readiness_warning_threshold"] == 75
        assert res_get.settings["readiness_critical_threshold"] == 55

        # 2. PATCH update with dict format
        patch_payload = {
            "updates": [
                {"key": "location_freshness_hours", "value": "12"},
                {"key": "default_report_days", "value": "60"}
            ]
        }
        updated_patch = settings_router.update_settings_patch(request=patch_payload, db=db, current_user=admin_user)
        assert len(updated_patch) == 2

        res_get2 = settings_router.get_settings(db=db, current_user=admin_user)
        assert res_get2.settings["location_freshness_hours"] == 12
        assert res_get2.settings["default_report_days"] == 60
    finally:
        db.close()


def test_6_validation_invalid_keys_and_blank_strings():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")

        # Unknown key
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "non_existent_key_123", "value": "foo"}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 for unknown key"
        except HTTPException as e:
            assert e.status_code == 422

        # Blank system name
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "system_name", "value": "   "}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 for blank system_name"
        except HTTPException as e:
            assert e.status_code == 422

        # Invalid boolean
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "automation_enabled", "value": "maybe"}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 for invalid boolean"
        except HTTPException as e:
            assert e.status_code == 422
    finally:
        db.close()


def test_7_validation_numeric_ranges():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")

        # Readiness warning > 100
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "readiness_warning_threshold", "value": "120"}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 for warning threshold > 100"
        except HTTPException as e:
            assert e.status_code == 422

        # Low stock ratio < 1.0
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "inventory_low_stock_ratio", "value": "0.4"}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 for low stock ratio < 1.0"
        except HTTPException as e:
            assert e.status_code == 422

        # Location freshness > 168 hours
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "location_freshness_hours", "value": "500"}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 for freshness > 168 hours"
        except HTTPException as e:
            assert e.status_code == 422
    finally:
        db.close()


def test_8_cross_field_validation():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")

        # Critical readiness >= Warning readiness
        try:
            settings_router.update_settings_put(
                request={"updates": [
                    {"key": "readiness_warning_threshold", "value": "60"},
                    {"key": "readiness_critical_threshold", "value": "65"}
                ]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 when critical >= warning threshold"
        except HTTPException as e:
            assert e.status_code == 422

        # Inventory critical >= low stock
        try:
            settings_router.update_settings_put(
                request={"updates": [
                    {"key": "inventory_low_stock_ratio", "value": "1.2"},
                    {"key": "inventory_critical_ratio", "value": "1.5"}
                ]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 when inventory critical >= low ratio"
        except HTTPException as e:
            assert e.status_code == 422

        # Automation critical <= high
        try:
            settings_router.update_settings_put(
                request={"updates": [
                    {"key": "automation_inventory_risk_high_threshold", "value": "80"},
                    {"key": "automation_inventory_risk_critical_threshold", "value": "70"}
                ]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 when automation critical <= high threshold"
        except HTTPException as e:
            assert e.status_code == 422
    finally:
        db.close()


def test_9_partial_update_db_cross_check():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")

        # Set active warning threshold to 75
        crud.update_settings(db, [{"key": "readiness_warning_threshold", "value": "75"}])

        # Attempt to set critical threshold to 80 (higher than existing 75 in DB)
        try:
            settings_router.update_settings_put(
                request={"updates": [{"key": "readiness_critical_threshold", "value": "80"}]},
                db=db, current_user=admin_user
            )
            assert False, "Expected 422 when updating critical threshold > existing warning threshold in DB"
        except HTTPException as e:
            assert e.status_code == 422
    finally:
        db.close()


def test_10_defaults_endpoint():
    admin_user = models.User(username="admin", role="ADMIN")
    defaults = settings_router.get_defaults(current_user=admin_user)
    assert defaults["system_name"] == "POLAR-X Command"
    assert defaults["readiness_warning_threshold"] == 70
    assert defaults["readiness_critical_threshold"] == 50
    assert defaults["inventory_low_stock_ratio"] == 1.5
    assert defaults["inventory_critical_ratio"] == 1.0
    assert defaults["automation_enabled"] is True


def test_11_automation_threshold_integration():
    db = get_db()
    try:
        admin_user = models.User(username="admin", role="ADMIN")

        # Set warning threshold to 80 and critical to 60
        settings_router.update_settings_put(
            request={"updates": [
                {"key": "readiness_warning_threshold", "value": "80"},
                {"key": "readiness_critical_threshold", "value": "60"}
            ]},
            db=db, current_user=admin_user
        )

        readiness_list = automation_router.get_expedition_readiness_analysis(db)
        assert len(readiness_list) > 0

        for r in readiness_list:
            if r.score >= 85:
                assert r.level == "READY"
            elif r.score >= 80:
                assert r.level == "ATTENTION"
            elif r.score >= 60:
                assert r.level == "AT_RISK"
            else:
                assert r.level == "CRITICAL"

        # Toggle automation_enabled to false
        settings_router.update_settings_put(
            request={"updates": [{"key": "automation_enabled", "value": "false"}]},
            db=db, current_user=admin_user
        )

        summary = automation_router.get_automation_summary(db)
        assert any("paused via system configuration" in act for act in summary.top_priority_actions)

        # Restore automation_enabled to true
        settings_router.update_settings_put(
            request={"updates": [
                {"key": "automation_enabled", "value": "true"},
                {"key": "readiness_warning_threshold", "value": "70"},
                {"key": "readiness_critical_threshold", "value": "50"}
            ]},
            db=db, current_user=admin_user
        )
    finally:
        db.close()


def test_12_dynamic_inventory_stock_threshold_impact():
    db = get_db()
    try:
        # Default ratios: low=1.5, crit=1.0
        # For an item with minimum_quantity=10:
        # qty=12 is <= 10 * 1.5 -> LOW_STOCK
        # If low_ratio changed to 1.1:
        # qty=12 is > 10 * 1.1 -> NORMAL
        status_default = crud.compute_inventory_status(quantity=12, minimum_quantity=10, low_stock_ratio=1.5, critical_ratio=1.0)
        assert status_default == "LOW_STOCK"

        status_custom = crud.compute_inventory_status(quantity=12, minimum_quantity=10, low_stock_ratio=1.1, critical_ratio=1.0)
        assert status_custom == "NORMAL"

        # Critical stock test:
        # qty=9 is < 10 * 1.0 -> CRITICAL
        # If crit_ratio changed to 0.8:
        # qty=9 is > 10 * 0.8 -> LOW_STOCK (since 9 <= 10 * 1.5)
        status_crit_default = crud.compute_inventory_status(quantity=9, minimum_quantity=10, low_stock_ratio=1.5, critical_ratio=1.0)
        assert status_crit_default == "CRITICAL"

        status_crit_custom = crud.compute_inventory_status(quantity=9, minimum_quantity=10, low_stock_ratio=1.5, critical_ratio=0.8)
        assert status_crit_custom == "LOW_STOCK"
    finally:
        db.close()


# ─── MAIN RUNNER ─────────────────────────────────────────────────────────────

def main():
    print("===================================================================")
    print("POLAR-X TASK 11 TEST SUITE: System Settings & Operational Config")
    print("===================================================================")

    run_test("1. Default settings seeding and data types", test_1_default_settings_seeding_and_types)
    run_test("2. Non-overwriting persistence ('defaults only if missing')", test_2_defaults_only_if_missing_persistence)
    run_test("3. Authenticated roles can GET /api/settings", test_3_get_settings_router_all_roles)
    run_test("4. RBAC: require_roles rejects non-admin with 403", test_4_rbac_require_roles_enforcement)
    run_test("5. Admin PUT and PATCH update settings persistence", test_5_update_settings_put_and_patch_admin)
    run_test("6. Input validation: unknown keys, blank strings, booleans", test_6_validation_invalid_keys_and_blank_strings)
    run_test("7. Numeric range validations", test_7_validation_numeric_ranges)
    run_test("8. Cross-field validations (warning > critical, low > crit ratio)", test_8_cross_field_validation)
    run_test("9. Partial update cross-check with active DB values", test_9_partial_update_db_cross_check)
    run_test("10. GET /api/settings/defaults endpoint", test_10_defaults_endpoint)
    run_test("11. Dynamic threshold integration with Task 10 Automation", test_11_automation_threshold_integration)
    run_test("12. Dynamic inventory stock ratio calculations", test_12_dynamic_inventory_stock_threshold_impact)

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
