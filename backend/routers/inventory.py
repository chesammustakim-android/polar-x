from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/inventory", tags=["Smart Inventory Management"])

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
