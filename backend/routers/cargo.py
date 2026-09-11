from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas, models

router = APIRouter(prefix="/api/cargo", tags=["Cargo & Asset Management"])

@router.get("", response_model=List[schemas.CargoOut])
def read_cargo_list(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="Filter by status (e.g. Preparing, In Transit, At Port, Loaded, Delivered, Delayed)"),
    priority: Optional[str] = Query(None, description="Filter by priority (Low, Medium, High, Critical)"),
    expedition_id: Optional[int] = Query(None, description="Filter by Expedition ID"),
    search: Optional[str] = Query(None, description="Search cargo code, name, category, or destination"),
    db: Session = Depends(get_db)
):
    """Retrieve all cold-chain cargo and polar equipment shipments with optional filters."""
    return crud.get_cargo_list(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        priority=priority,
        expedition_id=expedition_id,
        search=search
    )

@router.get("/stats", response_model=schemas.CargoSummaryStatsOut)
def read_cargo_stats(db: Session = Depends(get_db)):
    """Retrieve summary counts for total, in-transit, delivered, high priority, and delayed cargo."""
    return crud.get_cargo_summary_stats(db)

@router.get("/locations", response_model=List[schemas.CargoLocationMapOut])
def read_cargo_locations(db: Session = Depends(get_db)):
    """Retrieve cargo assets with valid geographic coordinates for map overlay."""
    return crud.get_cargo_locations(db)

@router.get("/{cargo_id}", response_model=schemas.CargoDetailOut)
def read_cargo_detail(cargo_id: int, db: Session = Depends(get_db)):
    """Retrieve complete cargo details including visual shipment stage and full movement history."""
    cargo = crud.get_cargo_detail(db, cargo_id=cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail=f"Cargo with ID {cargo_id} not found")
    return cargo

from ..auth import get_current_user


def require_cargo_manager(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Enforces that the user has Cargo / Logistics management authority."""
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR", "LOGISTICS_OFFICER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cargo management requires LOGISTICS_OFFICER, EXPEDITION_DIRECTOR, or ADMIN authority. Your role: {current_user.role}"
        )
    return current_user


def require_movement_updater(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Enforces that the user can record cargo movement checkpoints."""
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR", "LOGISTICS_OFFICER", "FIELD_OPERATOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cargo movement logging requires field or logistics authority. Your role: {current_user.role}"
        )
    return current_user


@router.post("", response_model=schemas.CargoOut, status_code=status.HTTP_201_CREATED)
def create_cargo_item(
    cargo: schemas.CargoCreate, 
    current_user: models.User = Depends(require_cargo_manager),
    db: Session = Depends(get_db)
):
    """Register a new cargo asset manifest and create initial movement record."""
    # Check if cargo_code already exists
    existing = crud.get_cargo_by_code(db, cargo_code=cargo.cargo_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Cargo with code {cargo.cargo_code} already exists")
    return crud.create_cargo(db=db, cargo=cargo)

@router.put("/{cargo_id}", response_model=schemas.CargoOut)
def update_cargo_item(
    cargo_id: int, 
    cargo_update: schemas.CargoUpdate, 
    current_user: models.User = Depends(require_cargo_manager),
    db: Session = Depends(get_db)
):
    """
    Update cargo status, location, notes, or ETA.
    Automatically creates a movement history entry.
    """
    updated = crud.update_cargo(db=db, cargo_id=cargo_id, cargo_update=cargo_update)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Cargo with ID {cargo_id} not found")
    return updated

@router.get("/{cargo_id}/history", response_model=List[schemas.CargoMovementOut])
def read_cargo_history(cargo_id: int, db: Session = Depends(get_db)):
    """Retrieve chronological movement history trail for a cargo item."""
    cargo = crud.get_cargo(db, cargo_id=cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail=f"Cargo with ID {cargo_id} not found")
    return crud.get_cargo_movements(db, cargo_id=cargo_id)

@router.post("/{cargo_id}/movement", response_model=schemas.CargoMovementOut, status_code=status.HTTP_201_CREATED)
def add_cargo_movement(
    cargo_id: int, 
    movement: schemas.CargoMovementCreate, 
    current_user: models.User = Depends(require_movement_updater),
    db: Session = Depends(get_db)
):
    """Manually append a movement checkpoint to cargo history and update current location."""
    cargo = crud.get_cargo(db, cargo_id=cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail=f"Cargo with ID {cargo_id} not found")
    
    # Update cargo current status and location
    crud.update_cargo(
        db=db, 
        cargo_id=cargo_id, 
        cargo_update=schemas.CargoUpdate(
            status=movement.status,
            current_location=movement.location,
            notes=movement.notes
        )
    )
    
    return crud.create_cargo_movement(
        db=db,
        cargo_id=cargo_id,
        status=movement.status,
        location=movement.location,
        notes=movement.notes,
        timestamp=movement.timestamp
    )

@router.get("/{cargo_id}/qr-data", response_model=schemas.CargoQRDataOut)
def read_cargo_qr_data(cargo_id: int, db: Session = Depends(get_db)):
    """Retrieve encrypted/formatted QR code payload for a cargo item."""
    qr_data = crud.get_cargo_qr_data(db, cargo_id=cargo_id)
    if not qr_data:
        raise HTTPException(status_code=404, detail=f"Cargo with ID {cargo_id} not found")
    return qr_data
