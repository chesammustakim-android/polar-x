from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas, models
from ..auth import get_current_user

router = APIRouter(prefix="/api/expeditions", tags=["Expeditions"])

def require_expedition_planner(current_user: models.User = Depends(get_current_user)) -> models.User:
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR", "EXPEDITION_LEADER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Expedition creation requires EXPEDITION_LEADER, EXPEDITION_DIRECTOR, or ADMIN authority. Your role: {current_user.role}"
        )
    return current_user

@router.get("", response_model=List[schemas.ExpeditionOut])
def read_expeditions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieve all polar scientific expeditions."""
    return crud.get_expeditions(db, skip=skip, limit=limit)

@router.post("", response_model=schemas.ExpeditionOut, status_code=status.HTTP_201_CREATED)
def create_expedition(
    expedition: schemas.ExpeditionCreate, 
    current_user: models.User = Depends(require_expedition_planner),
    db: Session = Depends(get_db)
):
    """Create a new polar scientific expedition."""
    return crud.create_expedition(db=db, exp=expedition)

@router.get("/{expedition_id}", response_model=schemas.ExpeditionOut)
def read_expedition(expedition_id: int, db: Session = Depends(get_db)):
    """Get specific expedition details by ID."""
    db_exp = crud.get_expedition(db, expedition_id=expedition_id)
    if not db_exp:
        raise HTTPException(status_code=404, detail=f"Expedition with ID {expedition_id} not found")
    return db_exp
