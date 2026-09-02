from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/expeditions", tags=["Expeditions"])

@router.get("", response_model=List[schemas.ExpeditionOut])
def read_expeditions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieve all polar scientific expeditions."""
    return crud.get_expeditions(db, skip=skip, limit=limit)

@router.post("", response_model=schemas.ExpeditionOut, status_code=status.HTTP_201_CREATED)
def create_expedition(expedition: schemas.ExpeditionCreate, db: Session = Depends(get_db)):
    """Create a new polar scientific expedition."""
    return crud.create_expedition(db=db, exp=expedition)

@router.get("/{expedition_id}", response_model=schemas.ExpeditionOut)
def read_expedition(expedition_id: int, db: Session = Depends(get_db)):
    """Get specific expedition details by ID."""
    db_exp = crud.get_expedition(db, expedition_id=expedition_id)
    if not db_exp:
        raise HTTPException(status_code=404, detail=f"Expedition with ID {expedition_id} not found")
    return db_exp
