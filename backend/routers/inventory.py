from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas, models
from ..auth import get_current_user

router = APIRouter(prefix="/api/inventory", tags=["Smart Inventory Management"])


def require_director_or_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires EXPEDITION_DIRECTOR or ADMIN. Your role: {current_user.role}"
        )
    return current_user




@router.get("/station-intelligence", response_model=List[schemas.StationIntelligenceItemOut])
def get_station_inventory_intelligence(
    station_id: Optional[int] = Query(None, description="Filter by station ID (Director/Admin only)"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns station resource intelligence: burn rate, trend, days-to-minimum, and risk
    derived from real StationResourceRequirement and DailyConsumptionRecord data.

    STATION_HEAD: automatically scoped to assigned station; station_id param is ignored.
    EXPEDITION_DIRECTOR / ADMIN: can filter by station_id or get all stations.
    """
    role = (current_user.role or "").upper()

    if role == "STATION_HEAD":
        # Enforce station scope — ignore any query param
        effective_station_id = current_user.assigned_station_id
        if effective_station_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your Station Head account is not yet assigned to a station. Contact your administrator."
            )
    elif role in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        effective_station_id = station_id  # None = all stations
    else:
        raise HTTPException(
            status_code=403,
            detail="Station resource intelligence requires Station Head, Expedition Director, or Admin access."
        )

    raw = crud.get_station_resource_intelligence(db, station_id=effective_station_id)

    results = []
    for item in raw:
        results.append(schemas.StationIntelligenceItemOut(
            requirement_id=item["requirement_id"],
            station_id=item["station_id"],
            station_name=item["station_name"],
            item_code=item["item_code"],
            item_name=item["item_name"],
            minimum_quantity=item["minimum_quantity"],
            unit=item["unit"],
            current_stock=item["current_stock"],
            surplus_deficit=item["surplus_deficit"],
            burn_rate_value=item["burn_rate_value"],
            burn_rate_text=item["burn_rate_text"],
            trend=item["trend"],
            trend_pct=item["trend_pct"],
            days_remaining=item["days_remaining"],
            days_to_minimum=item["days_to_minimum"],
            forecast_status=item["forecast_status"],
            risk_score=item["risk_score"],
            risk_level=item["risk_level"],
            risk_factors=item["risk_factors"],
            why_flagged=item["why_flagged"],
            consumption_record_count=item["consumption_record_count"],
            has_sufficient_history=item["has_sufficient_history"],
        ))

    # Sort: URGENT/CRITICAL first, then by risk_score desc
    priority_order = {"URGENT": 0, "CRITICAL": 1, "LOW": 2, "NORMAL": 3}
    results.sort(key=lambda x: (priority_order.get(x.risk_level, 9), -x.risk_score))
    return results

@router.get("", response_model=List[schemas.InventoryOut])
def read_inventory_list(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="Filter by status (NORMAL, LOW_STOCK, CRITICAL, OUT_OF_STOCK)"),
    category: Optional[str] = Query(None, description="Filter by category (Food, Fuel, Medical, Scientific Equipment, Clothing, Communication, Safety Equipment, Spare Parts, Other)"),
    expedition_id: Optional[int] = Query(None, description="Filter by assigned Expedition ID"),
    search: Optional[str] = Query(None, description="Search item code, name, category, or location"),
    db: Session = Depends(get_db)
):
    """Retrieve all polar inventory items with optional status, category, expedition, and keyword filters."""
    return crud.get_inventory_list(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        category=category,
        expedition_id=expedition_id,
        search=search
    )

@router.get("/summary", response_model=schemas.InventorySummaryStatsOut)
def read_inventory_summary(db: Session = Depends(get_db)):
    """Retrieve aggregated inventory counts (total items, low stock, critical, out of stock, normal, total quantity)."""
    return crud.get_inventory_summary_stats(db)

@router.get("/readiness", response_model=List[schemas.ExpeditionReadinessOut])
def read_all_expeditions_readiness(db: Session = Depends(get_db)):
    """Calculate supply readiness percentages and requirements breakdown for all expeditions."""
    return crud.get_expedition_readiness(db)

@router.get("/readiness/{expedition_id}", response_model=schemas.ExpeditionReadinessOut)
def read_expedition_readiness(expedition_id: int, db: Session = Depends(get_db)):
    """Calculate supply readiness and item requirements breakdown for a specific expedition."""
    readiness_list = crud.get_expedition_readiness(db, expedition_id=expedition_id)
    if not readiness_list:
        raise HTTPException(status_code=404, detail=f"Expedition with ID {expedition_id} not found")
    return readiness_list[0]

@router.get("/donors", response_model=List[schemas.DonorRecommendationOut])
def get_donor_recommendations(
    station_id: int = Query(..., description="Destination station ID needing supply"),
    item_code: str = Query(..., description="Item code with shortage"),
    deficit: Optional[float] = Query(None, description="How much is needed (units)"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Find donor stations that can safely supply an item_code to the destination station.
    Only stations where (current_stock - minimum_required) > 0 are eligible.
    Ranked by distance ASC, surplus DESC.
    Accessible to STATION_HEAD (own station), EXPEDITION_DIRECTOR, ADMIN.
    """
    role = (current_user.role or "").upper()
    if role == "STATION_HEAD":
        if current_user.assigned_station_id != station_id:
            raise HTTPException(
                status_code=403,
                detail="Station Head can only query donor recommendations for their assigned station."
            )
    elif role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(status_code=403, detail="Insufficient privileges for donor recommendations.")

    return crud.get_donor_recommendations(db, destination_station_id=station_id, item_code=item_code, deficit=deficit)


@router.post("/station/{station_id}/consumption", response_model=schemas.DailyConsumptionRecordOut, status_code=status.HTTP_201_CREATED)
def record_daily_consumption_from_inventory(
    station_id: int,
    data: schemas.DailyConsumptionRecordCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convenience endpoint to record daily consumption from the Inventory page context.
    STATION_HEAD: assigned station only. EXPEDITION_DIRECTOR/ADMIN: any station.
    Updates inventory stock (STOCK_OUT) and records DailyConsumptionRecord.
    """
    role = (current_user.role or "").upper()
    if role == "STATION_HEAD":
        if current_user.assigned_station_id != station_id:
            raise HTTPException(status_code=403, detail="Station Head restricted to assigned station.")
    elif role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(status_code=403, detail="Insufficient privileges to record consumption.")

    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found.")

    try:
        db_rec = crud.create_daily_consumption(
            db=db,
            station_id=station_id,
            data=data,
            user_id=current_user.id,
            username=current_user.full_name or current_user.username
        )
        return schemas.DailyConsumptionRecordOut(
            id=db_rec.id,
            station_id=db_rec.station_id,
            station_name=station.name,
            item_code=db_rec.item_code,
            item_name=db_rec.item_name,
            consumption_date=db_rec.consumption_date,
            consumed_quantity=db_rec.consumed_quantity,
            unit=db_rec.unit,
            notes=db_rec.notes,
            recorded_at=db_rec.recorded_at,
            recorded_by_user_id=db_rec.recorded_by_user_id,
            recorded_by=db_rec.recorded_by
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{item_id}", response_model=schemas.InventoryDetailOut)
def read_inventory_detail(item_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed inventory specifications and full stock transaction history."""
    detail = crud.get_inventory_detail(db, item_id=item_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Inventory item with ID {item_id} not found")
    return detail

@router.post("", response_model=schemas.InventoryOut, status_code=status.HTTP_201_CREATED)
def create_inventory_item(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    """
    Register a new inventory resource item.
    Status is automatically computed by backend business logic.
    Initial transaction history record is created automatically.
    """
    # Check if item_code already exists
    existing = crud.get_inventory_item_by_code(db, item_code=item.item_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Inventory item with code '{item.item_code}' already exists")
    
    if item.quantity < 0:
        raise HTTPException(status_code=400, detail="Initial stock quantity cannot be negative")
    if item.minimum_quantity < 0:
        raise HTTPException(status_code=400, detail="Minimum required quantity cannot be negative")

    return crud.create_inventory(db=db, item=item)

@router.put("/{item_id}", response_model=schemas.InventoryOut)
def update_inventory_item(item_id: int, item_update: schemas.InventoryUpdate, db: Session = Depends(get_db)):
    """Update item metadata (minimum threshold, category, unit, location, expedition)."""
    updated = crud.update_inventory(db=db, item_id=item_id, item_update=item_update)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Inventory item with ID {item_id} not found")
    return updated

@router.post("/{item_id}/stock", response_model=schemas.InventoryOut)
def perform_stock_operation(
    item_id: int, 
    stock_update: schemas.InventoryStockUpdate, 
    db: Session = Depends(get_db)
):
    """
    Perform an atomic stock update operation (STOCK_IN, STOCK_OUT, ADJUSTMENT).
    - Rejects STOCK_OUT exceeding current available stock.
    - Prevents negative quantity.
    - Recalculates item status.
    - Records an immutable transaction history entry.
    - Automatically generates an alert if transitioning to LOW_STOCK, CRITICAL, or OUT_OF_STOCK.
    """
    updated_item, err_msg = crud.update_inventory_stock(
        db=db,
        item_id=item_id,
        stock_update=stock_update
    )
    if err_msg:
        if err_msg == "Item not found":
            raise HTTPException(status_code=404, detail=f"Inventory item with ID {item_id} not found")
        raise HTTPException(status_code=400, detail=err_msg)
    
    return updated_item

@router.get("/{item_id}/history", response_model=List[schemas.InventoryTransactionOut])
def read_inventory_history(
    item_id: int, 
    limit: int = Query(50, description="Max transaction entries to return"), 
    db: Session = Depends(get_db)
):
    """Retrieve chronological stock audit log (STOCK_IN, STOCK_OUT, ADJUSTMENT) for an inventory item."""
    item = crud.get_inventory_item(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item with ID {item_id} not found")
    return crud.get_inventory_transactions(db, inventory_id=item_id, limit=limit)
