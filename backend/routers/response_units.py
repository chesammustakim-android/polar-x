from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/response-units", tags=["Search and Rescue (SAR) Response Units"])

@router.get("", response_model=List[schemas.ResponseUnitOut])
def read_response_units(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="Filter by status (AVAILABLE, DISPATCHED, ON_MISSION, UNAVAILABLE, RETURNING, OFF_DUTY)"),
    unit_type: Optional[str] = Query(None, description="Filter by unit type (MEDICAL_TEAM, FIELD_TEAM, VEHICLE, HELICOPTER, RESCUE_TEAM, STATION_SUPPORT, OTHER)"),
    team: Optional[str] = Query(None, description="Filter by team"),
    search: Optional[str] = Query(None, description="Search code, name, capability, or location"),
    db: Session = Depends(get_db)
):
    """Retrieve all SAR response units with availability status."""
    return crud.get_response_units(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        unit_type=unit_type,
        team=team,
        search=search
    )

@router.get("/locations", response_model=List[schemas.ResponseUnitLocationMapOut])
def read_response_unit_locations(db: Session = Depends(get_db)):
    """Retrieve response unit coordinates and mission status for polar map tracking layer."""
    return crud.get_response_unit_locations(db)

@router.get("/{unit_id}", response_model=schemas.ResponseUnitOut)
def read_response_unit(unit_id: int, db: Session = Depends(get_db)):
    """Retrieve single response unit details and status."""
    unit = crud.get_response_unit(db, unit_id=unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail=f"Response Unit with ID {unit_id} not found")
    return unit

@router.post("", response_model=schemas.ResponseUnitOut, status_code=status.HTTP_201_CREATED)
def create_new_response_unit(unit: schemas.ResponseUnitCreate, db: Session = Depends(get_db)):
    """Register a new polar SAR response unit."""
    existing = crud.get_response_unit_by_code(db, unit.unit_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Response Unit with code '{unit.unit_code}' already exists")

    if unit.latitude < -90.0 or unit.latitude > 90.0:
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if unit.longitude < -180.0 or unit.longitude > 180.0:
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    db_unit = crud.create_response_unit(db, unit)
    return crud.get_response_unit(db, db_unit.id)

@router.put("/{unit_id}", response_model=schemas.ResponseUnitOut)
def update_response_unit_info(
    unit_id: int,
    unit_update: schemas.ResponseUnitUpdate,
    db: Session = Depends(get_db)
):
    """Update response unit operational status, location coordinates, or capabilities."""
    if unit_update.latitude is not None and (unit_update.latitude < -90.0 or unit_update.latitude > 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if unit_update.longitude is not None and (unit_update.longitude < -180.0 or unit_update.longitude > 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    updated = crud.update_response_unit(db, unit_id, unit_update)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Response Unit with ID {unit_id} not found")
    return crud.get_response_unit(db, unit_id)
