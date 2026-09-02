from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/incidents", tags=["Emergency Response & SAR Incidents"])

@router.get("", response_model=List[schemas.IncidentOut])
def read_incidents(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="Filter by status (REPORTED, ACKNOWLEDGED, TRIAGED, DISPATCHED, IN_PROGRESS, RESOLVED, CANCELLED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)"),
    incident_type: Optional[str] = Query(None, description="Filter by type (MEDICAL, MISSING_PERSON, VEHICLE, CARGO, FIRE, COMMUNICATION_LOSS, WEATHER_ENVIRONMENTAL, OTHER)"),
    is_active: Optional[bool] = Query(None, description="Filter active vs resolved/cancelled"),
    assigned: Optional[bool] = Query(None, description="Filter assigned vs unassigned"),
    search: Optional[str] = Query(None, description="Search keyword in code, title, description, location"),
    db: Session = Depends(get_db)
):
    """Retrieve all emergency incidents with optional multi-filtering."""
    return crud.get_incidents(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        severity=severity,
        incident_type=incident_type,
        is_active=is_active,
        assigned=assigned,
        search=search
    )

@router.get("/active", response_model=List[schemas.IncidentOut])
def read_active_incidents(db: Session = Depends(get_db)):
    """Retrieve all currently active / unresolved emergency incidents."""
    return crud.get_active_incidents(db)

@router.get("/summary", response_model=schemas.IncidentSummaryStatsOut)
def read_incidents_summary(db: Session = Depends(get_db)):
    """Retrieve aggregated operational emergency statistics and available units."""
    return crud.get_incident_summary_stats(db)

@router.get("/locations", response_model=List[schemas.IncidentLocationMapOut])
def read_incident_locations(db: Session = Depends(get_db)):
    """Retrieve geospatial coordinates and status of incidents for polar map layer."""
    return crud.get_incident_locations(db)

@router.get("/{incident_id}", response_model=schemas.IncidentDetailOut)
def read_incident_detail(incident_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed incident dossier, personnel, assigned unit, audit timeline, and recommendations."""
    detail = crud.get_incident_detail(db, incident_id=incident_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")
    return detail

@router.post("", response_model=schemas.IncidentOut, status_code=status.HTTP_201_CREATED)
def create_new_incident(inc: schemas.IncidentCreate, db: Session = Depends(get_db)):
    """
    Manually report and register a new polar emergency incident.
    Validates numeric coordinates (-90 to 90 lat, -180 to 180 lon).
    """
    if inc.latitude is not None and (inc.latitude < -90.0 or inc.latitude > 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if inc.longitude is not None and (inc.longitude < -180.0 or inc.longitude > 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    if inc.personnel_id:
        person = crud.get_personnel(db, inc.personnel_id)
        if not person:
            raise HTTPException(status_code=404, detail=f"Personnel with ID {inc.personnel_id} not found")

    if inc.assigned_unit_id:
        unit = crud.get_response_unit(db, inc.assigned_unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail=f"Response Unit with ID {inc.assigned_unit_id} not found")

    return crud.create_incident(db, inc, actor=inc.reported_by)

@router.put("/{incident_id}", response_model=schemas.IncidentOut)
def update_incident_info(
    incident_id: int,
    inc_update: schemas.IncidentUpdate,
    db: Session = Depends(get_db)
):
    """Update general incident metadata and coordinates."""
    if inc_update.latitude is not None and (inc_update.latitude < -90.0 or inc_update.latitude > 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and +90.0")
    if inc_update.longitude is not None and (inc_update.longitude < -180.0 or inc_update.longitude > 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and +180.0")

    db_inc = crud.get_incident(db, incident_id)
    if not db_inc:
        raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")

    update_dict = inc_update.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_inc, key, value)

    db.commit()
    db.refresh(db_inc)
    return crud.enrich_incident_out(db, db_inc)

@router.get("/{incident_id}/history", response_model=List[schemas.IncidentEventOut])
def read_incident_history(incident_id: int, db: Session = Depends(get_db)):
    """Retrieve chronological immutable audit event history for an incident."""
    inc = crud.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")
    return crud.get_incident_events(db, incident_id)

@router.get("/{incident_id}/recommend-units", response_model=List[schemas.ResponseUnitRecommendationOut])
def get_recommended_units(incident_id: int, db: Session = Depends(get_db)):
    """Calculate Haversine distance and capability matches to recommend available SAR response units."""
    inc = crud.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident with ID {incident_id} not found")
    return crud.recommend_response_units(db, incident_id)

@router.post("/{incident_id}/acknowledge", response_model=schemas.IncidentOut)
def acknowledge_incident_route(
    incident_id: int,
    action: schemas.IncidentActionUpdate = None,
    db: Session = Depends(get_db)
):
    """Operator acknowledgement of reported emergency incident."""
    actor = action.actor if action else "Logistics Director"
    notes = action.notes if action else None
    result, err = crud.acknowledge_incident(db, incident_id=incident_id, actor=actor, notes=notes)
    if err:
        raise HTTPException(status_code=400 if "Cannot" in err else 404, detail=err)
    return result

@router.post("/{incident_id}/triage", response_model=schemas.IncidentOut)
def triage_incident_route(
    incident_id: int,
    triage_update: schemas.IncidentTriageUpdate,
    db: Session = Depends(get_db)
):
    """Update incident severity and transition to TRIAGED state with audit record."""
    result, err = crud.triage_incident(db, incident_id=incident_id, triage_update=triage_update)
    if err:
        raise HTTPException(status_code=400 if "Invalid" in err or "Cannot" in err else 404, detail=err)
    return result

@router.post("/{incident_id}/assign", response_model=schemas.IncidentOut)
def assign_response_unit_route(
    incident_id: int,
    assign_update: schemas.IncidentAssignUpdate,
    db: Session = Depends(get_db)
):
    """Assign an available SAR response unit to an incident."""
    result, err = crud.assign_incident_unit(db, incident_id=incident_id, assign_update=assign_update)
    if err:
        raise HTTPException(status_code=400 if "cannot" in err.lower() or "not found" in err.lower() else 404, detail=err)
    return result

@router.post("/{incident_id}/dispatch", response_model=schemas.IncidentOut)
def dispatch_response_unit_route(
    incident_id: int,
    action: schemas.IncidentActionUpdate = None,
    db: Session = Depends(get_db)
):
    """Dispatch the assigned response unit to the incident coordinates."""
    act = action or schemas.IncidentActionUpdate()
    result, err = crud.dispatch_incident(db, incident_id=incident_id, action_update=act)
    if err:
        raise HTTPException(status_code=400 if "cannot" in err.lower() or "without" in err.lower() else 404, detail=err)
    return result

@router.post("/{incident_id}/start", response_model=schemas.IncidentOut)
def start_response_mission_route(
    incident_id: int,
    action: schemas.IncidentActionUpdate = None,
    db: Session = Depends(get_db)
):
    """Mark response mission actively IN_PROGRESS on scene."""
    act = action or schemas.IncidentActionUpdate()
    result, err = crud.start_incident_mission(db, incident_id=incident_id, action_update=act)
    if err:
        raise HTTPException(status_code=400 if "cannot" in err.lower() else 404, detail=err)
    return result

@router.post("/{incident_id}/resolve", response_model=schemas.IncidentOut)
def resolve_incident_route(
    incident_id: int,
    resolve_update: schemas.IncidentResolveUpdate,
    db: Session = Depends(get_db)
):
    """Resolve incident with required operational resolution notes and release response unit."""
    result, err = crud.resolve_incident(db, incident_id=incident_id, resolve_update=resolve_update)
    if err:
        raise HTTPException(status_code=400 if "required" in err.lower() or "already" in err.lower() else 404, detail=err)
    return result

@router.post("/{incident_id}/cancel", response_model=schemas.IncidentOut)
def cancel_incident_route(
    incident_id: int,
    action: schemas.IncidentActionUpdate = None,
    db: Session = Depends(get_db)
):
    """Cancel incident and release any assigned response unit."""
    act = action or schemas.IncidentActionUpdate()
    result, err = crud.cancel_incident(db, incident_id=incident_id, action_update=act)
    if err:
        raise HTTPException(status_code=400 if "already" in err.lower() else 404, detail=err)
    return result
