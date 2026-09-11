"""
POLAR-X Pass 3 Focused Tests
Tests for: daily consumption stock coupling, donor eligibility, transfer lifecycle, RBAC, stale-stock protection.
Uses a fresh in-memory SQLite DB per test. Does NOT touch polar_x.db.
Run: python -m pytest test_pass3.py -v
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend import models, crud, schemas

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()

# counter for unique item codes
_ic = 0
def _item_code():
    global _ic
    _ic += 1
    return f"FUEL-T{_ic:04d}"


def _create_station(db, name="Alpha", lat=-70.0, lon=11.7):
    st = models.Station(
        name=name, type="Research Station",
        region="Antarctica", status="ACTIVE",
        latitude=lat, longitude=lon,
        description=f"Test station {name}",
        created_at="2026-01-01T00:00:00"
    )
    db.add(st); db.commit(); db.refresh(st)
    return st


def _create_inventory(db, item_code="FUEL-001", qty=1000.0, min_qty=200.0):
    item = models.Inventory(
        item_code=item_code, item_name="Test Fuel",
        category="Fuel", quantity=qty, minimum_quantity=min_qty,
        unit="Litres", location="Storage", burn_rate="Standard",
        days_remaining=100, status="NORMAL",
        created_at="2026-01-01T00:00:00", updated_at="2026-01-01T00:00:00"
    )
    db.add(item); db.commit(); db.refresh(item)
    return item



def _create_requirement(db, station_id, item_code, min_qty=200.0):
    req = models.StationResourceRequirement(
        station_id=station_id, item_code=item_code, item_name="Test Fuel",
        minimum_quantity=min_qty, unit="Litres", is_active=True,
        created_at="2026-01-01T00:00:00", updated_at="2026-01-01T00:00:00"
    )
    db.add(req); db.commit(); db.refresh(req)
    return req


# ---------------------------------------------------------------------------
# 1. Consumption entry creates stock-out and consumption record
# ---------------------------------------------------------------------------
def test_consumption_creates_stock_out():
    db = make_session()
    st = _create_station(db, "Maitri")
    inv = _create_inventory(db, qty=1000.0, min_qty=100.0)
    data = schemas.DailyConsumptionRecordCreate(
        item_code="FUEL-001", item_name="Test Fuel",
        consumption_date="2026-09-01", consumed_quantity=50.0, unit="Litres"
    )
    rec = crud.create_daily_consumption(db, st.id, data, user_id=1, username="Officer")
    assert rec.consumed_quantity == 50.0
    db.refresh(inv)
    assert inv.quantity == 950.0
    # Transaction created
    txs = crud.get_inventory_transactions(db, inv.id)
    stock_outs = [t for t in txs if t.transaction_type == "STOCK_OUT"]
    assert len(stock_outs) >= 1
    assert stock_outs[0].quantity == 50.0


# ---------------------------------------------------------------------------
# 2. Zero consumption rejected
# ---------------------------------------------------------------------------
def test_zero_consumption_rejected():
    db = make_session()
    st = _create_station(db, "Zero")
    _create_inventory(db)
    data = schemas.DailyConsumptionRecordCreate(
        item_code="FUEL-001", consumption_date="2026-09-01", consumed_quantity=0.0
    )
    with pytest.raises(ValueError, match="greater than zero"):
        crud.create_daily_consumption(db, st.id, data)


# ---------------------------------------------------------------------------
# 3. Consumption exceeding stock rejected
# ---------------------------------------------------------------------------
def test_consumption_cannot_go_negative():
    db = make_session()
    st = _create_station(db, "Low")
    _create_inventory(db, qty=10.0)
    data = schemas.DailyConsumptionRecordCreate(
        item_code="FUEL-001", consumption_date="2026-09-01", consumed_quantity=500.0
    )
    with pytest.raises(ValueError, match="Insufficient stock"):
        crud.create_daily_consumption(db, st.id, data)


# ---------------------------------------------------------------------------
# 4. Duplicate consumption date rejected
# ---------------------------------------------------------------------------
def test_duplicate_consumption_rejected():
    db = make_session()
    st = _create_station(db, "Dup")
    _create_inventory(db, qty=1000.0)
    data = schemas.DailyConsumptionRecordCreate(
        item_code="FUEL-001", consumption_date="2026-09-01", consumed_quantity=10.0
    )
    crud.create_daily_consumption(db, st.id, data)
    with pytest.raises(ValueError, match="already exists"):
        crud.create_daily_consumption(db, st.id, data)


# ---------------------------------------------------------------------------
# 5. Invalid date format rejected
# ---------------------------------------------------------------------------
def test_invalid_date_rejected():
    db = make_session()
    st = _create_station(db, "Inv")
    _create_inventory(db)
    data = schemas.DailyConsumptionRecordCreate(
        item_code="FUEL-001", consumption_date="01-09-2026", consumed_quantity=10.0
    )
    with pytest.raises(ValueError, match="Invalid date"):
        crud.create_daily_consumption(db, st.id, data)


# ---------------------------------------------------------------------------
# 6. Non-existent item rejected
# ---------------------------------------------------------------------------
def test_nonexistent_item_rejected():
    db = make_session()
    st = _create_station(db, "Miss")
    data = schemas.DailyConsumptionRecordCreate(
        item_code="GHOST-999", consumption_date="2026-09-01", consumed_quantity=5.0
    )
    with pytest.raises(ValueError, match="does not exist in inventory"):
        crud.create_daily_consumption(db, st.id, data)


# ---------------------------------------------------------------------------
# 7. Donor ineligible if surplus <= 0
# ---------------------------------------------------------------------------
def test_donor_ineligible_no_surplus():
    db = make_session()
    src = _create_station(db, "Source", lat=-70.0, lon=12.0)
    dst = _create_station(db, "Dest", lat=-71.0, lon=14.0)
    _create_inventory(db, qty=200.0, min_qty=200.0)  # stock == minimum → surplus = 0
    _create_requirement(db, src.id, "FUEL-001", min_qty=200.0)
    donors = crud.get_donor_recommendations(db, dst.id, "FUEL-001", deficit=100.0)
    assert len(donors) == 0


# ---------------------------------------------------------------------------
# 8. Donor eligible with surplus
# ---------------------------------------------------------------------------
def test_donor_eligible_with_surplus():
    db = make_session()
    src = _create_station(db, "Src", lat=-70.0, lon=12.0)
    dst = _create_station(db, "Dst", lat=-71.0, lon=14.0)
    _create_inventory(db, qty=500.0, min_qty=100.0)  # surplus = 400
    _create_requirement(db, src.id, "FUEL-001", min_qty=100.0)
    donors = crud.get_donor_recommendations(db, dst.id, "FUEL-001", deficit=200.0)
    assert len(donors) >= 1
    d = donors[0]
    assert d.donor_transferable_surplus == 400.0
    assert d.recommended_transfer_quantity == 200.0  # min(deficit, surplus)


# ---------------------------------------------------------------------------
# 9. Transfer request lifecycle: create → approve → complete
# ---------------------------------------------------------------------------
def test_transfer_lifecycle():
    db = make_session()
    src = _create_station(db, "SrcA", lat=-70.0, lon=12.0)
    dst = _create_station(db, "DstA", lat=-71.0, lon=14.0)
    inv = _create_inventory(db, qty=500.0, min_qty=100.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=100.0)

    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=200.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="Station Head")
    assert tr.status == "REQUESTED"
    assert tr.requested_quantity == 200.0

    # Approve
    tr = crud.review_transfer_request(db, tr.id, "APPROVED", approved_quantity=150.0, approver_id=2, approver_name="Director")
    assert tr.status == "APPROVED"
    assert tr.approved_quantity == 150.0
    db.refresh(inv)
    assert inv.quantity == 500.0  # Approval alone does NOT change stock

    # Complete
    tr = crud.complete_transfer_request(db, tr.id, completer_id=2, completer_name="Director")
    assert tr.status == "COMPLETED"
    assert tr.transferred_quantity == 150.0
    db.refresh(inv)
    # Net effect of STOCK_OUT(-150) + STOCK_IN(+150) = zero change on shared inventory
    assert inv.quantity == 500.0


# ---------------------------------------------------------------------------
# 10. Approval does not change stock
# ---------------------------------------------------------------------------
def test_approval_does_not_change_stock():
    db = make_session()
    src = _create_station(db, "S2", lat=-70.0, lon=12.0)
    dst = _create_station(db, "D2", lat=-71.0, lon=14.0)
    inv = _create_inventory(db, qty=600.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=100.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="Officer")
    before_qty = inv.quantity
    crud.review_transfer_request(db, tr.id, "APPROVED", approved_quantity=100.0, approver_id=2)
    db.refresh(inv)
    assert inv.quantity == before_qty  # No stock change from approval


# ---------------------------------------------------------------------------
# 11. Transfer rejected
# ---------------------------------------------------------------------------
def test_transfer_rejection():
    db = make_session()
    src = _create_station(db, "S3", lat=-70.0, lon=12.0)
    dst = _create_station(db, "D3", lat=-71.0, lon=14.0)
    _create_inventory(db, qty=600.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=100.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    tr = crud.review_transfer_request(db, tr.id, "REJECTED", approver_notes="Not justified", approver_id=2)
    assert tr.status == "REJECTED"


# ---------------------------------------------------------------------------
# 12. Cannot complete a REQUESTED (not APPROVED) transfer
# ---------------------------------------------------------------------------
def test_cannot_complete_requested_transfer():
    db = make_session()
    src = _create_station(db, "S4")
    dst = _create_station(db, "D4")
    _create_inventory(db, qty=600.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=100.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    with pytest.raises(ValueError, match="Only APPROVED"):
        crud.complete_transfer_request(db, tr.id)


# ---------------------------------------------------------------------------
# 13. Duplicate completion rejected
# ---------------------------------------------------------------------------
def test_duplicate_completion_rejected():
    db = make_session()
    src = _create_station(db, "S5", lat=-70.0, lon=12.0)
    dst = _create_station(db, "D5", lat=-71.0, lon=14.0)
    _create_inventory(db, qty=600.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=100.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    crud.review_transfer_request(db, tr.id, "APPROVED", approved_quantity=100.0, approver_id=2)
    crud.complete_transfer_request(db, tr.id, completer_id=2)
    with pytest.raises(ValueError, match="already COMPLETED"):
        crud.complete_transfer_request(db, tr.id, completer_id=2)


# ---------------------------------------------------------------------------
# 14. Stale-stock protection: stock drops between approval and completion
# ---------------------------------------------------------------------------
def test_stale_stock_protection():
    db = make_session()
    src = _create_station(db, "S6", lat=-70.0, lon=12.0)
    dst = _create_station(db, "D6", lat=-71.0, lon=14.0)
    inv = _create_inventory(db, qty=300.0, min_qty=100.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=100.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=150.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    crud.review_transfer_request(db, tr.id, "APPROVED", approved_quantity=150.0, approver_id=2)

    # Stock drops drastically between approval and completion
    inv.quantity = 110.0  # only 10 above minimum
    db.commit()

    # 150 would bring stock to -40, below minimum of 100
    with pytest.raises(ValueError, match="insufficient"):
        crud.complete_transfer_request(db, tr.id, completer_id=2)


# ---------------------------------------------------------------------------
# 15. Transfer request: source == destination rejected
# ---------------------------------------------------------------------------
def test_self_transfer_rejected():
    db = make_session()
    st = _create_station(db, "Same")
    _create_inventory(db, qty=600.0, min_qty=50.0)
    _create_requirement(db, st.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=st.id, item_code="FUEL-001", requested_quantity=100.0
    )
    with pytest.raises(ValueError, match="must be different"):
        crud.create_transfer_request(db, st.id, data, user_id=1, username="SH")


# ---------------------------------------------------------------------------
# 16. Transfer request exceeding safe surplus rejected
# ---------------------------------------------------------------------------
def test_transfer_exceeds_surplus_rejected():
    db = make_session()
    src = _create_station(db, "Over1")
    dst = _create_station(db, "Over2")
    _create_inventory(db, qty=300.0, min_qty=200.0)  # surplus = 100
    _create_requirement(db, src.id, "FUEL-001", min_qty=200.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=200.0  # exceeds surplus of 100
    )
    with pytest.raises(ValueError, match="surplus"):
        crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")


# ---------------------------------------------------------------------------
# 17. Cancel a REQUESTED transfer
# ---------------------------------------------------------------------------
def test_cancel_requested_transfer():
    db = make_session()
    src = _create_station(db, "SC")
    dst = _create_station(db, "DC")
    _create_inventory(db, qty=500.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=50.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    tr = crud.cancel_transfer_request(db, tr.id, cancelled_by="Station Head")
    assert tr.status == "CANCELLED"


# ---------------------------------------------------------------------------
# 18. Cannot cancel a COMPLETED transfer
# ---------------------------------------------------------------------------
def test_cannot_cancel_completed():
    db = make_session()
    src = _create_station(db, "CC1", lat=-70.0, lon=12.0)
    dst = _create_station(db, "CC2", lat=-71.0, lon=14.0)
    _create_inventory(db, qty=500.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=50.0
    )
    tr = crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    crud.review_transfer_request(db, tr.id, "APPROVED", approved_quantity=50.0, approver_id=2)
    crud.complete_transfer_request(db, tr.id)
    with pytest.raises(ValueError, match="cannot be cancelled"):
        crud.cancel_transfer_request(db, tr.id)


# ---------------------------------------------------------------------------
# 19. List transfers filtered by station
# ---------------------------------------------------------------------------
def test_list_transfers_by_station():
    db = make_session()
    src = _create_station(db, "LS1")
    dst = _create_station(db, "LS2")
    other = _create_station(db, "LS3")
    _create_inventory(db, qty=1000.0, min_qty=50.0)
    _create_requirement(db, src.id, "FUEL-001", min_qty=50.0)
    data = schemas.StationTransferRequestCreate(
        source_station_id=src.id, item_code="FUEL-001", requested_quantity=50.0
    )
    crud.create_transfer_request(db, dst.id, data, user_id=1, username="SH")
    # Should be visible for src and dst, not for other
    src_transfers = crud.get_transfer_requests(db, station_id=src.id)
    other_transfers = crud.get_transfer_requests(db, station_id=other.id)
    assert len(src_transfers) >= 1
    assert len(other_transfers) == 0


# ---------------------------------------------------------------------------
# 20. Consumption creates alert if stock drops below threshold
# ---------------------------------------------------------------------------
def test_consumption_status_update():
    db = make_session()
    st = _create_station(db, "Alert")
    inv = _create_inventory(db, qty=210.0, min_qty=200.0)  # only 10 above min
    data = schemas.DailyConsumptionRecordCreate(
        item_code="FUEL-001", consumption_date="2026-09-01", consumed_quantity=20.0  # drops to 190 < 200
    )
    crud.create_daily_consumption(db, st.id, data)
    db.refresh(inv)
    assert inv.quantity == 190.0
    assert inv.status in ("CRITICAL", "LOW_STOCK", "OUT_OF_STOCK")
