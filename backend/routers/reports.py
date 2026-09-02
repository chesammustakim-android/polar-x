from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from ..database import get_db
from .. import models, schemas

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports & Analytics"]
)

def _get_current_timestamp():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

@router.get("/summary", response_model=schemas.ReportsSummaryOut)
def get_reports_summary(db: Session = Depends(get_db)):
    """
    Comprehensive aggregated reports summary including executive KPIs,
    status distributions across all polar operations modules, and deterministic
    operational risk insights.
    """
    # 1. Expeditions
    expeditions = db.query(models.Expedition).all()
    total_expeditions = len(expeditions)
    active_expeditions = sum(1 for e in expeditions if (e.status or "").lower() in ["active", "ongoing"])
    completed_expeditions = sum(1 for e in expeditions if (e.status or "").lower() == "completed")
    avg_readiness = (
        round(sum(e.readiness or 0 for e in expeditions) / total_expeditions, 1)
        if total_expeditions > 0 else 100.0
    )
    expeditions_by_status = {}
    for e in expeditions:
        st = e.status or "Active"
        expeditions_by_status[st] = expeditions_by_status.get(st, 0) + 1

    # 2. Cargo
    cargo_items = db.query(models.Cargo).all()
    total_cargo = len(cargo_items)
    cargo_in_transit = sum(1 for c in cargo_items if c.status == "In Transit")
    cargo_delivered = sum(1 for c in cargo_items if c.status == "Delivered")
    cargo_delayed = sum(1 for c in cargo_items if c.status == "Delayed")
    
    cargo_by_status = {}
    cargo_by_category = {}
    for c in cargo_items:
        st = c.status or "Preparing"
        cat = c.category or "General Supply"
        cargo_by_status[st] = cargo_by_status.get(st, 0) + 1
        cargo_by_category[cat] = cargo_by_category.get(cat, 0) + 1

    # 3. Inventory
    inventory_items = db.query(models.Inventory).all()
    total_inventory = len(inventory_items)
    low_stock = sum(1 for i in inventory_items if i.status == "LOW_STOCK")
    critical_stock = sum(1 for i in inventory_items if i.status == "CRITICAL")
    out_of_stock = sum(1 for i in inventory_items if i.status == "OUT_OF_STOCK")

    inventory_by_status = {}
    inventory_by_category = {}
    for i in inventory_items:
        st = i.status or "NORMAL"
        cat = i.category or "Other"
        inventory_by_status[st] = inventory_by_status.get(st, 0) + 1
        inventory_by_category[cat] = inventory_by_category.get(cat, 0) + 1

    # 4. Personnel
    personnel_list = db.query(models.Personnel).all()
    total_personnel = len(personnel_list)
    personnel_at_station = sum(1 for p in personnel_list if p.status == "AT_STATION")
    personnel_field = sum(1 for p in personnel_list if p.status in ["FIELD", "IN_TRANSIT"])
    personnel_emergency = sum(1 for p in personnel_list if p.status == "EMERGENCY")

    personnel_by_status = {}
    personnel_by_department = {}
    for p in personnel_list:
        st = p.status or "AT_STATION"
        dept = p.department or "Science & Research"
        personnel_by_status[st] = personnel_by_status.get(st, 0) + 1
        personnel_by_department[dept] = personnel_by_department.get(dept, 0) + 1

    # 5. Incidents
    incidents = db.query(models.Incident).all()
    total_incidents = len(incidents)
    active_incidents = sum(1 for inc in incidents if inc.status not in ["RESOLVED", "CANCELLED"])
    critical_incidents = sum(1 for inc in incidents if inc.severity == "CRITICAL" and inc.status not in ["RESOLVED", "CANCELLED"])
    resolved_incidents = sum(1 for inc in incidents if inc.status == "RESOLVED")

    incidents_by_severity = {}
    incidents_by_type = {}
    incidents_by_status = {}
    for inc in incidents:
        sev = inc.severity or "HIGH"
        itype = inc.incident_type or "OTHER"
        st = inc.status or "REPORTED"
        incidents_by_severity[sev] = incidents_by_severity.get(sev, 0) + 1
        incidents_by_type[itype] = incidents_by_type.get(itype, 0) + 1
        incidents_by_status[st] = incidents_by_status.get(st, 0) + 1

    # 6. Generate Deterministic Operational Insights
    insights = []
    
    # A. Active Critical Incidents
    for inc in incidents:
        if inc.status not in ["RESOLVED", "CANCELLED"] and inc.severity == "CRITICAL":
            insights.append(schemas.OperationalInsightItem(
                id=f"insight-inc-{inc.id}",
                type="CRITICAL_EMERGENCY",
                severity="CRITICAL",
                title=f"Critical Emergency: {inc.title}",
                message=f"Incident {inc.incident_code} ({inc.location_name}) is at CRITICAL severity with status {inc.status}.",
                entity_id=inc.id,
                entity_type="incident",
                action_hint="Dispatch emergency response unit or escalate SAR operations immediately."
            ))

    # B. Personnel in EMERGENCY status
    for p in personnel_list:
        if p.status == "EMERGENCY":
            insights.append(schemas.OperationalInsightItem(
                id=f"insight-pers-{p.id}",
                type="FIELD_RISK",
                severity="CRITICAL",
                title=f"Personnel SOS: {p.name} ({p.personnel_code})",
                message=f"{p.name} is currently flagged in EMERGENCY status at {p.current_location}.",
                entity_id=p.id,
                entity_type="personnel",
                action_hint="Check vital telemetry and verify SAR rescue unit vector."
            ))

    # C. Critical / Out-of-stock inventory
    for inv in inventory_items:
        if inv.status in ["CRITICAL", "OUT_OF_STOCK"]:
            deficit = max(0, inv.minimum_quantity - inv.quantity)
            insights.append(schemas.OperationalInsightItem(
                id=f"insight-inv-{inv.id}",
                type="SUPPLY_DEFICIT",
                severity="HIGH" if inv.status == "CRITICAL" else "CRITICAL",
                title=f"Supply Stockout Risk: {inv.item_name}",
                message=f"{inv.item_name} at {inv.location} has {inv.quantity} {inv.unit} remaining (Min threshold: {inv.minimum_quantity} {inv.unit}, Deficit: {deficit} {inv.unit}).",
                entity_id=inv.id,
                entity_type="inventory",
                action_hint="Initiate priority supply manifest replenishment from Cape Town / Goa."
            ))

    # D. Delayed Cargo Assets
    for c in cargo_items:
        if c.status == "Delayed":
            insights.append(schemas.OperationalInsightItem(
                id=f"insight-crg-{c.id}",
                type="DELAYED_CARGO",
                severity="MEDIUM",
                title=f"Cargo Transit Delay: {c.name} ({c.cargo_code})",
                message=f"Consignment {c.cargo_code} destined for {c.destination} is flagged as Delayed at {c.current_location}.",
                entity_id=c.id,
                entity_type="cargo",
                action_hint="Verify logistics convoy or icebreaker vessel ETA."
            ))

    # E. Low Readiness Expeditions
    for e in expeditions:
        if (e.readiness or 100) < 85 and (e.status or "").lower() in ["active", "ongoing"]:
            insights.append(schemas.OperationalInsightItem(
                id=f"insight-exp-{e.id}",
                type="LOW_READINESS",
                severity="MEDIUM",
                title=f"Expedition Readiness Gap: {e.name}",
                message=f"{e.name} has a calculated readiness score of {e.readiness}%, below the 85% operational benchmark.",
                entity_id=e.id,
                entity_type="expedition",
                action_hint="Review inventory requirement checklist and fuel reserve buffer."
            ))

    # Assemble response
    kpis = schemas.ReportsSummaryKPIs(
        total_expeditions=total_expeditions,
        active_expeditions=active_expeditions,
        completed_expeditions=completed_expeditions,
        average_expedition_readiness=avg_readiness,
        total_cargo=total_cargo,
        cargo_in_transit=cargo_in_transit,
        cargo_delivered=cargo_delivered,
        cargo_delayed=cargo_delayed,
        total_inventory_items=total_inventory,
        low_stock_items=low_stock,
        critical_stock_items=critical_stock,
        out_of_stock_items=out_of_stock,
        total_personnel=total_personnel,
        personnel_at_station=personnel_at_station,
        personnel_field=personnel_field,
        personnel_emergency=personnel_emergency,
        total_incidents=total_incidents,
        active_incidents=active_incidents,
        critical_incidents=critical_incidents,
        resolved_incidents=resolved_incidents
    )

    return schemas.ReportsSummaryOut(
        kpis=kpis,
        personnel_by_status=personnel_by_status,
        personnel_by_department=personnel_by_department,
        cargo_by_status=cargo_by_status,
        cargo_by_category=cargo_by_category,
        inventory_by_status=inventory_by_status,
        inventory_by_category=inventory_by_category,
        incidents_by_severity=incidents_by_severity,
        incidents_by_type=incidents_by_type,
        incidents_by_status=incidents_by_status,
        expeditions_by_status=expeditions_by_status,
        operational_insights=insights,
        timestamp=_get_current_timestamp()
    )


@router.get("/expeditions", response_model=List[schemas.ExpeditionOut])
def get_reports_expeditions(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Expedition)
    if status and status != "ALL":
        query = query.filter(models.Expedition.status == status)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            models.Expedition.name.ilike(s) |
            models.Expedition.location.ilike(s) |
            models.Expedition.leader.ilike(s)
        )
    return query.all()


@router.get("/cargo", response_model=List[schemas.CargoOut])
def get_reports_cargo(
    expedition_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Cargo)
    if expedition_id:
        query = query.filter(models.Cargo.expedition_id == expedition_id)
    if status and status != "ALL":
        query = query.filter(models.Cargo.status == status)
    if category and category != "ALL":
        query = query.filter(models.Cargo.category == category)
    if priority and priority != "ALL":
        query = query.filter(models.Cargo.priority == priority)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            models.Cargo.name.ilike(s) |
            models.Cargo.cargo_code.ilike(s) |
            models.Cargo.origin.ilike(s) |
            models.Cargo.destination.ilike(s)
        )
    return query.order_by(models.Cargo.id.desc()).all()


@router.get("/inventory", response_model=List[schemas.InventoryOut])
def get_reports_inventory(
    expedition_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Inventory)
    if expedition_id:
        query = query.filter(models.Inventory.expedition_id == expedition_id)
    if category and category != "ALL":
        query = query.filter(models.Inventory.category == category)
    if status and status != "ALL":
        query = query.filter(models.Inventory.status == status)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            models.Inventory.item_name.ilike(s) |
            models.Inventory.item_code.ilike(s) |
            models.Inventory.location.ilike(s)
        )
    return query.order_by(models.Inventory.id.desc()).all()


@router.get("/personnel", response_model=List[schemas.PersonnelOut])
def get_reports_personnel(
    expedition_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Personnel)
    if expedition_id:
        query = query.filter(models.Personnel.expedition_id == expedition_id)
    if role and role != "ALL":
        query = query.filter(models.Personnel.role == role)
    if department and department != "ALL":
        query = query.filter(models.Personnel.department == department)
    if status and status != "ALL":
        query = query.filter(models.Personnel.status == status)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            models.Personnel.name.ilike(s) |
            models.Personnel.personnel_code.ilike(s) |
            models.Personnel.current_location.ilike(s) |
            models.Personnel.specialization.ilike(s)
        )
    return query.order_by(models.Personnel.id.desc()).all()


@router.get("/incidents", response_model=List[schemas.IncidentOut])
def get_reports_incidents(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    incident_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Incident)
    if severity and severity != "ALL":
        query = query.filter(models.Incident.severity == severity)
    if status and status != "ALL":
        query = query.filter(models.Incident.status == status)
    if incident_type and incident_type != "ALL":
        query = query.filter(models.Incident.incident_type == incident_type)
    if is_active is True:
        query = query.filter(~models.Incident.status.in_(["RESOLVED", "CANCELLED"]))
    elif is_active is False:
        query = query.filter(models.Incident.status.in_(["RESOLVED", "CANCELLED"]))
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            models.Incident.title.ilike(s) |
            models.Incident.incident_code.ilike(s) |
            models.Incident.location_name.ilike(s)
        )
    
    incidents = query.order_by(models.Incident.id.desc()).all()
    results = []
    for inc in incidents:
        item = schemas.IncidentOut.model_validate(inc)
        if inc.personnel:
            item.personnel_name = inc.personnel.name
            item.personnel_code = inc.personnel.personnel_code
        if inc.assigned_unit:
            item.assigned_unit_code = inc.assigned_unit.unit_code
            item.assigned_unit_name = inc.assigned_unit.name
            item.assigned_unit_type = inc.assigned_unit.unit_type
        results.append(item)
    return results
