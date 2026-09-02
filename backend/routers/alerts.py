from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

@router.get("", response_model=List[schemas.AlertOut])
def read_alerts_list(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieve all emergency distress beacons, storm warnings, and logistics alerts."""
    return crud.get_alerts_list(db, skip=skip, limit=limit)

@router.post("", response_model=schemas.AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert_item(alert: schemas.AlertCreate, db: Session = Depends(get_db)):
    """Broadcast/log a new emergency alert or weather advisory."""
    return crud.create_alert(db=db, alert=alert)

@router.put("/{alert_id}", response_model=schemas.AlertOut)
def update_alert_item(alert_id: int, alert_update: schemas.AlertUpdate, db: Session = Depends(get_db)):
    """Acknowledge, resolve, or escalate an active emergency alert."""
    updated = crud.update_alert(db=db, alert_id=alert_id, alert_update=alert_update)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Alert with ID {alert_id} not found")
    return updated
