from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud, schemas, models
from ..auth import get_current_user

router = APIRouter(prefix="/api/stations", tags=["Polar Stations & Facilities"])


def require_director_or_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Enforces that the user has Expedition Director or Admin authority for station lifecycle/configuration."""
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Station configuration requires EXPEDITION_DIRECTOR or ADMIN privilege. Your role: {current_user.role}"
        )
    return current_user


def check_station_access(current_user: models.User, station_id: int):
    """
    Enforces that Station Heads can only access their assigned station.
    Admins and Expedition Directors have system-wide access.
    """
    role = (current_user.role or "").upper()
    if role in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        return True
    if role == "STATION_HEAD":
        if current_user.assigned_station_id == station_id:
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Station Head is strictly restricted to operations for their assigned station."
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient privileges to access station operational telemetry."
    )


# ─── STATION LIFECYCLE & DIRECTORY ───────────────────────────────────────────

@router.get("", response_model=List[schemas.StationOut])
def read_stations_list(
    type: Optional[str] = Query(None, description="Filter by station type"),
    region: Optional[str] = Query(None, description="Filter by region (e.g. Antarctica, Arctic)"),
    include_inactive: bool = Query(True, description="Whether to include inactive stations"),
    db: Session = Depends(get_db)
):
    """Retrieve all polar research stations, field camps, and facilities."""
    return crud.get_stations_list(db=db, type=type, region=region, include_inactive=include_inactive)


@router.get("/{station_id}", response_model=schemas.StationOut)
def read_station_detail(station_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a specific polar facility."""
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")
    return station


@router.post("", response_model=schemas.StationOut, status_code=status.HTTP_201_CREATED)
def create_station(
    station: schemas.StationCreate,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """Register a new station, outpost, or storage depot. Restricted to Expedition Director and Admin."""
    if not station.name or not station.name.strip():
        raise HTTPException(status_code=400, detail="Station name is required and cannot be blank.")

    if station.latitude < -90.0 or station.latitude > 90.0:
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if station.longitude < -180.0 or station.longitude > 180.0:
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    existing = crud.get_station_by_name(db, name=station.name.strip())
    if existing:
        raise HTTPException(status_code=400, detail=f"Station with name '{station.name}' already exists")

    return crud.create_station(db=db, station=station)


@router.put("/{station_id}", response_model=schemas.StationOut)
def update_station(
    station_id: int,
    station_update: schemas.StationUpdate,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """Update station metadata, coordinates, or elevation. Restricted to Expedition Director and Admin."""
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    if station_update.name is not None:
        name_clean = station_update.name.strip()
        if not name_clean:
            raise HTTPException(status_code=400, detail="Station name cannot be empty.")
        existing = crud.get_station_by_name(db, name=name_clean)
        if existing and existing.id != station_id:
            raise HTTPException(status_code=400, detail=f"Another station with name '{name_clean}' already exists.")

    if station_update.latitude is not None and (station_update.latitude < -90.0 or station_update.latitude > 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if station_update.longitude is not None and (station_update.longitude < -180.0 or station_update.longitude > 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    updated = crud.update_station(db, station_id=station_id, station_update=station_update)
    return updated


@router.patch("/{station_id}/deactivate", response_model=schemas.StationOut)
def deactivate_station(
    station_id: int,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """Deactivate a polar station (soft-deactivation, preserves all historical operational records)."""
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    return crud.deactivate_station(db, station_id=station_id)


@router.patch("/{station_id}/reactivate", response_model=schemas.StationOut)
def reactivate_station(
    station_id: int,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """Reactivate a polar station back to OPERATIONAL status."""
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    return crud.reactivate_station(db, station_id=station_id)


# ─── STATION RESOURCE REQUIREMENTS ───────────────────────────────────────────

@router.get("/{station_id}/requirements", response_model=List[schemas.StationResourceRequirementOut])
def get_station_requirements(
    station_id: int,
    active_only: bool = Query(True, description="Return active requirements only"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve persisted minimum required quantities for specific resources at a station.
    Expedition Director/Admin can view all; Station Head can view only assigned station.
    """
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    check_station_access(current_user, station_id)

    reqs = crud.get_station_requirements(db, station_id=station_id, active_only=active_only)
    return [
        schemas.StationResourceRequirementOut(
            id=r.id,
            station_id=r.station_id,
            station_name=station.name,
            item_code=r.item_code,
            item_name=r.item_name,
            minimum_quantity=r.minimum_quantity,
            unit=r.unit,
            is_active=r.is_active,
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        for r in reqs
    ]


@router.post("/{station_id}/requirements", response_model=schemas.StationResourceRequirementOut, status_code=status.HTTP_201_CREATED)
def create_station_requirement(
    station_id: int,
    req: schemas.StationResourceRequirementCreate,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a persisted minimum resource requirement for a station.
    Restricted to Expedition Director and Admin.
    """
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    try:
        db_req = crud.create_station_requirement(db, station_id=station_id, req=req)
        return schemas.StationResourceRequirementOut(
            id=db_req.id,
            station_id=db_req.station_id,
            station_name=station.name,
            item_code=db_req.item_code,
            item_name=db_req.item_name,
            minimum_quantity=db_req.minimum_quantity,
            unit=db_req.unit,
            is_active=db_req.is_active,
            created_at=db_req.created_at,
            updated_at=db_req.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{station_id}/requirements/{req_id}", response_model=schemas.StationResourceRequirementOut)
def update_station_requirement(
    station_id: int,
    req_id: int,
    req_update: schemas.StationResourceRequirementUpdate,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update an existing minimum resource requirement threshold.
    Restricted to Expedition Director and Admin.
    """
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    try:
        updated = crud.update_station_requirement(db, req_id=req_id, req_update=req_update)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Requirement with ID {req_id} not found")
        return schemas.StationResourceRequirementOut(
            id=updated.id,
            station_id=updated.station_id,
            station_name=station.name,
            item_code=updated.item_code,
            item_name=updated.item_name,
            minimum_quantity=updated.minimum_quantity,
            unit=updated.unit,
            is_active=updated.is_active,
            created_at=updated.created_at,
            updated_at=updated.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{station_id}/requirements/{req_id}")
def delete_station_requirement(
    station_id: int,
    req_id: int,
    current_user: models.User = Depends(require_director_or_admin),
    db: Session = Depends(get_db)
):
    """
    Deactivate a station resource requirement (soft-deactivation).
    Restricted to Expedition Director and Admin.
    """
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    deactivated = crud.deactivate_station_requirement(db, req_id=req_id)
    if not deactivated:
        raise HTTPException(status_code=404, detail=f"Requirement with ID {req_id} not found")

    return {
        "status": "deactivated",
        "message": f"Resource requirement {req_id} successfully deactivated for {station.name}."
    }


# ─── DAILY CONSUMPTION REGISTRY ──────────────────────────────────────────────

@router.get("/{station_id}/consumption", response_model=List[schemas.DailyConsumptionRecordOut])
def get_station_consumption(
    station_id: int,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=500),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve persistent daily consumption records for a station.
    Expedition Director/Admin can view all; Station Head can view only assigned station.
    """
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    check_station_access(current_user, station_id)

    records = crud.get_station_consumption_history(
        db, station_id=station_id, start_date=start_date, end_date=end_date, limit=limit
    )

    return [
        schemas.DailyConsumptionRecordOut(
            id=r.id,
            station_id=r.station_id,
            station_name=station.name,
            item_code=r.item_code,
            item_name=r.item_name,
            consumption_date=r.consumption_date,
            consumed_quantity=r.consumed_quantity,
            unit=r.unit,
            notes=r.notes,
            recorded_at=r.recorded_at,
            recorded_by_user_id=r.recorded_by_user_id,
            recorded_by=r.recorded_by
        )
        for r in records
    ]


@router.post("/{station_id}/consumption", response_model=schemas.DailyConsumptionRecordOut, status_code=status.HTTP_201_CREATED)
def record_daily_consumption(
    station_id: int,
    data: schemas.DailyConsumptionRecordCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record daily consumption for a station.
    Authorized for Station Head (assigned station only), Expedition Director, and Admin.
    """
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")

    # Authorize: Station Head can only record for their assigned station
    check_station_access(current_user, station_id)

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
