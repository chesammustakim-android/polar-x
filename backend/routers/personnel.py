from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas, models

router = APIRouter(prefix="/api/personnel", tags=["Personnel Management & Movement Tracking"])

@router.get("", response_model=List[schemas.PersonnelOut])
def read_personnel_list(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="Filter by status (AT_STATION, FIELD, IN_TRANSIT, RESTING, EMERGENCY, OFF_DUTY)"),
    role: Optional[str] = Query(None, description="Filter by role (Expedition Leader, Scientist, Engineer, Medical Officer, Logistics Officer, Technician, Pilot, Field Operator)"),
    expedition_id: Optional[int] = Query(None, description="Filter by assigned Expedition ID"),
    search: Optional[str] = Query(None, description="Search personnel code, name, role, department, or current location"),
    db: Session = Depends(get_db)
):
    """Retrieve all polar personnel on roster with optional status, role, expedition, and keyword filters."""
    return crud.get_personnel_list(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        role=role,
        expedition_id=expedition_id,
        search=search
    )

@router.get("/summary", response_model=schemas.PersonnelSummaryStatsOut)
def read_personnel_summary(db: Session = Depends(get_db)):
    """Retrieve aggregated personnel status counts (total, at station, in field, in transit, emergency, resting, off duty)."""
    return crud.get_personnel_summary_stats(db)

@router.get("/locations", response_model=List[schemas.PersonnelLocationMapOut])
def read_personnel_locations(db: Session = Depends(get_db)):
    """Retrieve lightweight geospatial coordinates and status for all active polar personnel."""
    return crud.get_personnel_locations(db)

@router.get("/{personnel_id}", response_model=schemas.PersonnelDetailOut)
def read_personnel_detail(personnel_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed personnel dossier, expedition linkage, and full movement history trail."""
    detail = crud.get_personnel_detail(db, personnel_id=personnel_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Personnel with ID {personnel_id} not found")
    return detail

from .. import crud, schemas, models
from ..auth import get_current_user


def require_personnel_manager(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Enforces that the user has Personnel roster management authority."""
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR", "EXPEDITION_LEADER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Personnel roster management requires EXPEDITION_LEADER, EXPEDITION_DIRECTOR, or ADMIN authority. Your role: {current_user.role}"
        )
    return current_user


def require_location_updater(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Enforces that the user can update field personnel locations."""
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR", "EXPEDITION_LEADER", "FIELD_OPERATOR", "SAR_OFFICER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Field location updates require authorized operational role. Your role: {current_user.role}"
        )
    return current_user


@router.post("", response_model=schemas.PersonnelOut, status_code=status.HTTP_201_CREATED)
def create_personnel_member(
    person: schemas.PersonnelCreate, 
    current_user: models.User = Depends(require_personnel_manager),
    db: Session = Depends(get_db)
):
    """
    Register a new personnel member on the expedition roster.
    Validates numeric coordinates (-90 to 90 lat, -180 to 180 long).
    Automatically creates initial movement history entry.
    """
    existing = crud.get_personnel_by_code(db, personnel_code=person.personnel_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Personnel with code '{person.personnel_code}' already exists")
    
    if person.latitude < -90.0 or person.latitude > 90.0:
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if person.longitude < -180.0 or person.longitude > 180.0:
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    return crud.create_personnel(db=db, person=person)

@router.put("/{personnel_id}", response_model=schemas.PersonnelOut)
def update_personnel_member(
    personnel_id: int, 
    person_update: schemas.PersonnelUpdate, 
    current_user: models.User = Depends(require_personnel_manager),
    db: Session = Depends(get_db)
):
    """Update personnel metadata (name, role, department, contact, assigned expedition)."""
    if person_update.latitude is not None and (person_update.latitude < -90.0 or person_update.latitude > 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if person_update.longitude is not None and (person_update.longitude < -180.0 or person_update.longitude > 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    updated = crud.update_personnel(db=db, personnel_id=personnel_id, person_update=person_update)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Personnel with ID {personnel_id} not found")
    return updated

@router.post("/{personnel_id}/location", response_model=schemas.PersonnelOut)
def update_personnel_location(
    personnel_id: int,
    location_update: schemas.PersonnelLocationUpdate,
    current_user: models.User = Depends(require_location_updater),
    db: Session = Depends(get_db)
):
    """
    Atomic location and movement update for a personnel member.
    - Saves previous location and coordinates.
    - Updates current location and numeric latitude/longitude.
    - Automatically appends immutable movement history entry.
    - Triggers emergency alert if transitioning into EMERGENCY status.
    """
    if location_update.latitude < -90.0 or location_update.latitude > 90.0:
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if location_update.longitude < -180.0 or location_update.longitude > 180.0:
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    updated_person, err_msg = crud.update_personnel_location(
        db=db,
        personnel_id=personnel_id,
        location_update=location_update
    )
    if err_msg:
        if err_msg == "Personnel not found":
            raise HTTPException(status_code=404, detail=f"Personnel with ID {personnel_id} not found")
        raise HTTPException(status_code=400, detail=err_msg)

    return updated_person

@router.get("/{personnel_id}/history", response_model=List[schemas.PersonnelMovementOut])
def read_personnel_movement_history(
    personnel_id: int, 
    limit: int = Query(50, description="Max movement history entries to return"),
    db: Session = Depends(get_db)
):
    """Retrieve chronological movement history trail for a personnel member."""
    person = crud.get_personnel(db, personnel_id=personnel_id)
    if not person:
        raise HTTPException(status_code=404, detail=f"Personnel with ID {personnel_id} not found")
    return crud.get_personnel_movements(db, personnel_id=personnel_id, limit=limit)

@router.post("/{personnel_id}/sos", response_model=schemas.IncidentOut)
def trigger_personnel_sos(
    personnel_id: int,
    body: dict = None,
    db: Session = Depends(get_db)
):
    """
    Trigger an emergency SOS for a personnel member.
    - Sets personnel status to EMERGENCY.
    - Creates a new CRITICAL MEDICAL incident (or returns existing active incident if one exists).
    - Prevents duplicate active SOS incidents for the same person.
    """
    reason = None
    actor = "Emergency SOS Trigger"
    if body:
        reason = body.get("reason")
        actor = body.get("actor", actor)

    incident, err = crud.create_or_get_personnel_sos_incident(
        db=db,
        personnel_id=personnel_id,
        reason=reason,
        actor=actor
    )
    if err:
        if "not found" in err.lower():
            raise HTTPException(status_code=404, detail=f"Personnel with ID {personnel_id} not found")
        raise HTTPException(status_code=400, detail=err)
    return incident

