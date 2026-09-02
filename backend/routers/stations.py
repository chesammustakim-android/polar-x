from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/stations", tags=["Polar Stations & Facilities"])

@router.get("", response_model=List[schemas.StationOut])
def read_stations_list(
    type: Optional[str] = Query(None, description="Filter by station type"),
    region: Optional[str] = Query(None, description="Filter by region (e.g. Antarctica, Arctic)"),
    db: Session = Depends(get_db)
):
    """Retrieve all operational polar research stations, field camps, and storage facilities."""
    return crud.get_stations_list(db=db, type=type, region=region)

@router.get("/{station_id}", response_model=schemas.StationOut)
def read_station_detail(station_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a specific polar facility."""
    station = crud.get_station(db, station_id=station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID {station_id} not found")
    return station

@router.post("", response_model=schemas.StationOut, status_code=status.HTTP_201_CREATED)
def create_station(station: schemas.StationCreate, db: Session = Depends(get_db)):
    """Register a new station, outpost, or storage depot with validated geographic coordinates."""
    if station.latitude < -90.0 or station.latitude > 90.0:
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if station.longitude < -180.0 or station.longitude > 180.0:
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    existing = crud.get_station_by_name(db, name=station.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Station with name '{station.name}' already exists")

    return crud.create_station(db=db, station=station)
