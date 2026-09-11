"""
POLAR-X Task 9 — Authentication & Role-Based Access Control Test Suite
Tests password hashing, token creation/verification, login, logout, me profile,
inactive user rejection, demo users list, and RBAC role permission checks.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

TEST_DB_URL = "sqlite:///./test_task9.db"

from backend.database import Base
from backend import models, crud, schemas
from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    get_role_permissions,
    require_roles,
    get_current_user
)
from backend.routers import auth

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

def test_password_hashing():
    pwd = "PolarSecret@2026"
    hashed = hash_password(pwd)
    assert hashed.startswith("pbkdf2_sha256$"), "Invalid hash prefix"
    assert verify_password(pwd, hashed) is True, "Password verification failed"
    assert verify_password("WrongPassword", hashed) is False, "Wrong password accepted"
    assert verify_password("", hashed) is False, "Empty password accepted"

def test_token_creation_and_validation():
    payload = {"sub": "admin", "user_id": 1, "role": "ADMIN"}
    token = create_access_token(payload, expires_hours=1)
    assert token and isinstance(token, str)
    assert len(token.split('.')) == 3, "Token should have 3 segments (header.payload.signature)"

    decoded = decode_access_token(token)
    assert decoded["sub"] == "admin"
    assert decoded["role"] == "ADMIN"
    assert "exp" in decoded

    # Test tampered token
    tampered_token = token[:-5] + "XXXXX"
    try:
        decode_access_token(tampered_token)
        assert False, "Tampered token should have failed verification"
    except HTTPException as e:
        assert e.status_code == 401

def test_valid_login():
    db = get_db()
    try:
        req = schemas.LoginRequest(username="admin", password="Polar@2026")
        res = auth.login(req, db)
        assert res.access_token is not None, "Missing access token"
        assert res.token_type == "bearer"
        assert res.user.username == "admin"
        assert res.user.role == "ADMIN"
        assert "dashboard" in res.user.permissions
        assert "settings" in res.user.permissions
    finally:
        db.close()

def test_invalid_password():
    db = get_db()
    try:
        req = schemas.LoginRequest(username="admin", password="IncorrectPassword!")
        try:
            auth.login(req, db)
            assert False, "Login with wrong password should fail"
        except HTTPException as e:
            assert e.status_code == 401
    finally:
        db.close()

def test_unknown_user():
    db = get_db()
    try:
        req = schemas.LoginRequest(username="nonexistent_user", password="Polar@2026")
        try:
            auth.login(req, db)
            assert False, "Login with unknown user should fail"
        except HTTPException as e:
            assert e.status_code == 401
    finally:
        db.close()

def test_inactive_user_rejection():
    db = get_db()
    try:
        # Check or create inactive user
        existing = db.query(models.User).filter(models.User.username == "inactive_test").first()
        if not existing:
            inactive = models.User(
                username="inactive_test",
                full_name="Inactive Officer",
                email="inactive@ncpor.res.in",
                password_hash=hash_password("Polar@2026"),
                role="FIELD_OPERATOR",
                active=False
            )
            db.add(inactive)
            db.commit()

        req = schemas.LoginRequest(username="inactive_test", password="Polar@2026")
        try:
            auth.login(req, db)
            assert False, "Inactive user login should be rejected with 403"
        except HTTPException as e:
            assert e.status_code == 403
    finally:
        db.close()

def test_get_current_user_profile():
    db = get_db()
    try:
        user = db.query(models.User).filter(models.User.username == "director").first()
        profile = auth.get_current_user_profile(user)
        assert profile.username == "director"
        assert profile.role == "EXPEDITION_DIRECTOR"
        assert "expeditions" in profile.permissions
        assert "emergency" in profile.permissions
    finally:
        db.close()

def test_demo_users_endpoint():
    demos = auth.get_demo_users()
    assert len(demos) == 7, f"Expected 7 demo users, got {len(demos)}"
    roles = [d.role for d in demos]
    assert "ADMIN" in roles
    assert "EXPEDITION_DIRECTOR" in roles
    assert "STATION_HEAD" in roles
    assert "LOGISTICS_OFFICER" in roles
    assert "EXPEDITION_LEADER" in roles
    assert "SAR_OFFICER" in roles
    assert "FIELD_OPERATOR" in roles

def test_role_based_access_control():
    db = get_db()
    try:
        admin_user = db.query(models.User).filter(models.User.username == "admin").first()
        sar_user = db.query(models.User).filter(models.User.username == "sar").first()
        field_user = db.query(models.User).filter(models.User.username == "field").first()

        # Admin can access everything
        admin_check = require_roles(["SAR_OFFICER", "LOGISTICS_OFFICER"])
        assert admin_check(admin_user) == admin_user

        # SAR Officer can access SAR roles
        sar_check = require_roles(["SAR_OFFICER"])
        assert sar_check(sar_user) == sar_user

        # Field operator denied access to Logistics
        logistics_check = require_roles(["LOGISTICS_OFFICER"])
        try:
            logistics_check(field_user)
            assert False, "Field user should not have access to Logistics role"
        except HTTPException as e:
            assert e.status_code == 403
    finally:
        db.close()

def test_logout_endpoint():
    res = auth.logout()
    assert res["status"] == "logged_out"


if __name__ == "__main__":
    print("=" * 60)
    print("POLAR-X Task 9 Authentication & RBAC Test Suite")
    print("=" * 60)

    run_test("1. PBKDF2 Password Hashing & Salt Verification", test_password_hashing)
    run_test("2. Signed Token Generation & Signature Validation", test_token_creation_and_validation)
    run_test("3. Valid User Authentication & JWT Token Issuance", test_valid_login)
    run_test("4. Invalid Password Authentication Rejection", test_invalid_password)
    run_test("5. Unknown User Authentication Rejection", test_unknown_user)
    run_test("6. Inactive User 403 Forbidden Rejection", test_inactive_user_rejection)
    run_test("7. Current User Profile & Role Permissions Lookup", test_get_current_user_profile)
    run_test("8. Deterministic Demo Users List", test_demo_users_endpoint)
    run_test("9. Role-Based Access Control (RBAC) Enforcement", test_role_based_access_control)
    run_test("10. User Session Termination (Logout)", test_logout_endpoint)

    print("\n" + "\n".join(RESULTS))
    print("=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed out of {PASS + FAIL} tests")
    print("=" * 60)

    # Clean up test db file
    if os.path.exists("test_task9.db"):
        try:
            os.remove("test_task9.db")
        except Exception:
            pass

    if FAIL > 0:
        sys.exit(1)
