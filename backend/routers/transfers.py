from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud, schemas, models
from ..auth import get_current_user

router = APIRouter(prefix="/api/transfers", tags=["Cross-Station Transfer Requests"])


def _require_director_or_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    role = (current_user.role or "").upper()
    if role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Transfer approval/completion requires EXPEDITION_DIRECTOR or ADMIN. Your role: {current_user.role}"
        )
    return current_user


@router.get("", response_model=List[schemas.StationTransferRequestOut])
def list_transfers(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List transfer requests.
    STATION_HEAD: only their assigned station (source or destination).
    EXPEDITION_DIRECTOR / ADMIN: all stations.
    """
    role = (current_user.role or "").upper()

    if role == "STATION_HEAD":
        station_id = current_user.assigned_station_id
        if not station_id:
            raise HTTPException(status_code=400, detail="Station Head account not assigned to a station.")
        raw_list = crud.get_transfer_requests(db, station_id=station_id, status=status_filter)
    elif role in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raw_list = crud.get_transfer_requests(db, station_id=None, status=status_filter)
    else:
        raise HTTPException(status_code=403, detail="Insufficient privileges to view transfer requests.")

    results = []
    for tr in raw_list:
        results.append(crud._transfer_out(db, tr))
    return results


@router.post("", response_model=schemas.StationTransferRequestOut, status_code=status.HTTP_201_CREATED)
def create_transfer_request(
    destination_station_id: int = Query(..., description="Destination station that needs the supply"),
    data: schemas.StationTransferRequestCreate = ...,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a REQUESTED cross-station transfer.
    STATION_HEAD: destination must be their assigned station.
    EXPEDITION_DIRECTOR / ADMIN: any station.
    """
    role = (current_user.role or "").upper()

    if role == "STATION_HEAD":
        if current_user.assigned_station_id is None:
            raise HTTPException(status_code=400, detail="Station Head account not assigned to a station.")
        if destination_station_id != current_user.assigned_station_id:
            raise HTTPException(
                status_code=403,
                detail="Station Head can only request supply for their own assigned station."
            )
    elif role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(status_code=403, detail="Insufficient privileges to create transfer requests.")

    try:
        db_tr = crud.create_transfer_request(
            db=db,
            destination_station_id=destination_station_id,
            data=data,
            user_id=current_user.id,
            username=current_user.full_name or current_user.username
        )
        return crud._transfer_out(db, db_tr)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{transfer_id}", response_model=schemas.StationTransferRequestOut)
def get_transfer(
    transfer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve a specific transfer request. Station Heads restricted to their station's records."""
    tr = crud.get_transfer_request(db, transfer_id)
    if not tr:
        raise HTTPException(status_code=404, detail=f"Transfer request {transfer_id} not found.")

    role = (current_user.role or "").upper()
    if role == "STATION_HEAD":
        sid = current_user.assigned_station_id
        if tr.source_station_id != sid and tr.destination_station_id != sid:
            raise HTTPException(status_code=403, detail="Transfer record belongs to a different station.")

    return crud._transfer_out(db, tr)


@router.post("/{transfer_id}/approve", response_model=schemas.StationTransferRequestOut)
def approve_transfer(
    transfer_id: int,
    body: schemas.StationTransferRequestReview,
    current_user: models.User = Depends(_require_director_or_admin),
    db: Session = Depends(get_db)
):
    """Approve a REQUESTED transfer. Does NOT change inventory stock."""
    try:
        tr = crud.review_transfer_request(
            db=db, transfer_id=transfer_id, action="APPROVED",
            approved_quantity=body.approved_quantity, approver_notes=body.approver_notes,
            approver_id=current_user.id, approver_name=current_user.full_name or current_user.username
        )
        return crud._transfer_out(db, tr)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{transfer_id}/reject", response_model=schemas.StationTransferRequestOut)
def reject_transfer(
    transfer_id: int,
    body: schemas.StationTransferRequestReview,
    current_user: models.User = Depends(_require_director_or_admin),
    db: Session = Depends(get_db)
):
    """Reject a REQUESTED transfer."""
    try:
        tr = crud.review_transfer_request(
            db=db, transfer_id=transfer_id, action="REJECTED",
            approved_quantity=None, approver_notes=body.approver_notes,
            approver_id=current_user.id, approver_name=current_user.full_name or current_user.username
        )
        return crud._transfer_out(db, tr)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{transfer_id}/complete", response_model=schemas.StationTransferRequestOut)
def complete_transfer(
    transfer_id: int,
    body: schemas.StationTransferRequestComplete,
    current_user: models.User = Depends(_require_director_or_admin),
    db: Session = Depends(get_db)
):
    """
    Complete an APPROVED transfer. Atomically updates both inventories.
    Re-validates donor stock against minimum (stale-stock protection).
    """
    try:
        tr = crud.complete_transfer_request(
            db=db, transfer_id=transfer_id, completion_notes=body.completion_notes,
            completer_id=current_user.id, completer_name=current_user.full_name or current_user.username
        )
        return crud._transfer_out(db, tr)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{transfer_id}/cancel", response_model=schemas.StationTransferRequestOut)
def cancel_transfer(
    transfer_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a REQUESTED or APPROVED transfer.
    Station Heads: own station REQUESTED transfers only.
    Director/Admin: any pre-COMPLETED transfer.
    """
    role = (current_user.role or "").upper()
    tr = crud.get_transfer_request(db, transfer_id)
    if not tr:
        raise HTTPException(status_code=404, detail=f"Transfer request {transfer_id} not found.")

    if role == "STATION_HEAD":
        sid = current_user.assigned_station_id
        if tr.destination_station_id != sid and tr.source_station_id != sid:
            raise HTTPException(status_code=403, detail="Cannot cancel a transfer for a different station.")
        if tr.status != "REQUESTED":
            raise HTTPException(
                status_code=400,
                detail=f"Station Head can only cancel REQUESTED transfers. Current: '{tr.status}'."
            )
    elif role not in ["ADMIN", "EXPEDITION_DIRECTOR"]:
        raise HTTPException(status_code=403, detail="Insufficient privileges to cancel transfers.")

    try:
        tr = crud.cancel_transfer_request(
            db=db, transfer_id=transfer_id,
            cancelled_by=current_user.full_name or current_user.username
        )
        return crud._transfer_out(db, tr)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
