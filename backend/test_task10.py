"""
POLAR-X Task 10 — Smart Automation & Predictive Operations Test Suite
Tests explainable scoring engines for expedition readiness, inventory shortage risk,
cargo logistics risk, personnel operational risk, emergency prioritization,
resource recommendations, and executive analytics summaries.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_task10.db"

from backend.database import Base
from backend import models, crud, schemas
from backend.routers import automation

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

def test_automation_summary():
    db = get_db()
    try:
        summary = automation.get_automation_summary(db)
        assert summary is not None
        assert 0 <= summary.overall_fleet_readiness <= 100
        assert 0 <= summary.overall_risk_index <= 100
        assert summary.expeditions_analyzed >= 1
        assert isinstance(summary.top_priority_actions, list)
        assert len(summary.top_priority_actions) > 0
        assert summary.analyzed_at is not None
    finally:
        db.close()

def test_expedition_readiness_analysis():
    db = get_db()
    try:
        results = automation.get_expedition_readiness_analysis(db)
        assert len(results) >= 1
        for exp in results:
            assert exp.expedition_id > 0
            assert exp.expedition_name
            assert 0 <= exp.score <= 100
            assert exp.level in ["READY", "ATTENTION", "AT_RISK", "CRITICAL"]
            assert len(exp.factors) > 0
            for f in exp.factors:
                assert f.name
                assert f.impact in ["POSITIVE", "NEGATIVE", "NEUTRAL"]
                assert f.description
            assert exp.explanation
            assert len(exp.recommended_actions) > 0
    finally:
        db.close()

def test_inventory_shortage_risk_analysis():
    db = get_db()
    try:
        results = automation.get_inventory_risk_analysis(db)
        assert len(results) >= 1
        # Verify sorted descending by risk score
        scores = [item.risk_score for item in results]
        assert scores == sorted(scores, reverse=True), "Inventory risks must be sorted highest first"

        for item in results:
            assert item.item_code
            assert 0 <= item.risk_score <= 100
            assert item.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            assert len(item.factors) > 0
            assert item.recommended_action
    finally:
        db.close()

def test_cargo_logistics_risk_analysis():
    db = get_db()
    try:
        results = automation.get_cargo_risk_analysis(db)
        assert len(results) >= 1
        for cargo in results:
            assert cargo.cargo_code
            assert 0 <= cargo.risk_score <= 100
            assert cargo.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            assert len(cargo.factors) > 0
            assert cargo.recommended_action

            # Delayed cargo should have elevated risk
            if cargo.status == "Delayed":
                assert cargo.risk_score >= 40.0, "Delayed cargo should have elevated risk score"
    finally:
        db.close()

def test_personnel_operational_risk_analysis():
    db = get_db()
    try:
        results = automation.get_personnel_risk_analysis(db)
        assert len(results) >= 1
        for p in results:
            assert p.personnel_code
            assert 0 <= p.operational_risk_score <= 100
            assert p.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            assert len(p.factors) > 0
            assert p.recommended_action

            # Personnel with EMERGENCY status must be flagged CRITICAL
            if p.status == "EMERGENCY":
                assert p.risk_level == "CRITICAL"
                assert p.operational_risk_score >= 75.0
    finally:
        db.close()

def test_emergency_priority_queue():
    db = get_db()
    try:
        queue = automation.get_emergency_priority_queue(db)
        assert len(queue) >= 1

        # Check ranking order
        ranks = [q.priority_rank for q in queue]
        assert ranks == list(range(1, len(queue) + 1)), "Priority ranks must be consecutive integers starting at 1"

        scores = [q.priority_score for q in queue]
        assert scores == sorted(scores, reverse=True), "Emergency priority queue must be sorted highest score first"

        for item in queue:
            assert item.incident_code
            assert item.priority_score > 0
            assert len(item.factors) > 0
            assert item.explanation
            assert item.recommended_action
    finally:
        db.close()

def test_resource_recommendations_non_dispatched():
    db = get_db()
    try:
        recs = automation.get_automation_recommendations(db)
        assert len(recs) >= 1
        for r in recs:
            assert r.incident_code
            assert isinstance(r.recommended_units, list)
            for unit_rec in r.recommended_units:
                assert unit_rec.unit.id > 0
                assert unit_rec.distance_km >= 0
                assert isinstance(unit_rec.is_available, bool)
                assert unit_rec.score > 0
                assert unit_rec.reason
    finally:
        db.close()

def test_explainability_contract():
    db = get_db()
    try:
        exp_list = automation.get_expedition_readiness_analysis(db)
        inv_list = automation.get_inventory_risk_analysis(db)
        crg_list = automation.get_cargo_risk_analysis(db)
        pers_list = automation.get_personnel_risk_analysis(db)
        em_list = automation.get_emergency_priority_queue(db)

        # Every analyzed entity must have non-empty factors and non-empty explanation/recommended action
        assert all(len(e.factors) > 0 and e.explanation for e in exp_list)
        assert all(len(i.factors) > 0 and i.explanation and i.recommended_action for i in inv_list)
        assert all(len(c.factors) > 0 and c.explanation and c.recommended_action for c in crg_list)
        assert all(len(p.factors) > 0 and p.explanation and p.recommended_action for p in pers_list)
        assert all(len(em.factors) > 0 and em.explanation and em.recommended_action for em in em_list)
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("POLAR-X Task 10 Smart Automation & Predictive Operations Test Suite")
    print("=" * 60)

    run_test("1. Automation Executive Summary & Fleet Metrics", test_automation_summary)
    run_test("2. Expedition Readiness Scoring & Factor Breakdown", test_expedition_readiness_analysis)
    run_test("3. Inventory Shortage Risk & Runway Analysis", test_inventory_shortage_risk_analysis)
    run_test("4. Cargo Logistics Delay & Transit Risk Scoring", test_cargo_logistics_risk_analysis)
    run_test("5. Personnel Operational Safety & Telemetry Risk", test_personnel_operational_risk_analysis)
    run_test("6. Emergency Urgency Priority Queue & Ranking", test_emergency_priority_queue)
    run_test("7. Operator-Controlled SAR Resource Recommendations", test_resource_recommendations_non_dispatched)
    run_test("8. Explainability & Contributing Factors Contract", test_explainability_contract)

    print("\n" + "\n".join(RESULTS))
    print("=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed out of {PASS + FAIL} tests")
    print("=" * 60)

    # Clean up test db file
    if os.path.exists("test_task10.db"):
        try:
            os.remove("test_task10.db")
        except Exception:
            pass

    if FAIL > 0:
        sys.exit(1)
