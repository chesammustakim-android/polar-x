from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas, crud

router = APIRouter(
    prefix="/api/automation",
    tags=["Smart Automation & Predictive Operations"]
)

def _get_current_timestamp() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

# ─── 1. EXPEDITION READINESS ANALYSIS ────────────────────────────────────────

@router.get("/expedition-readiness", response_model=List[schemas.ExpeditionReadinessAnalysisOut])
def get_expedition_readiness_analysis(db: Session = Depends(get_db)):
    """
    Transparent, explainable readiness analysis for polar expeditions based on
    inventory buffers, cargo transit punctuality, active field personnel, and unresolved emergencies.
    """
    expeditions = db.query(models.Expedition).all()
    results = []

    for exp in expeditions:
        factors = []
        base_score = float(exp.readiness or 90)

        # Factor 1: Baseline expedition readiness index
        factors.append(schemas.ContributingFactor(
            name="Baseline Operational Readiness",
            weight=base_score,
            impact="POSITIVE" if base_score >= 80 else "NEGATIVE",
            description=f"Initial logistics readiness benchmark calculated at {base_score}%."
        ))

        # Factor 2: Cargo transit punctuality
        delayed_cargo = db.query(models.Cargo).filter(
            models.Cargo.expedition_id == exp.id,
            models.Cargo.status == "Delayed"
        ).all()
        if delayed_cargo:
            cargo_penalty = min(25.0, len(delayed_cargo) * 12.5)
            base_score = max(10.0, base_score - cargo_penalty)
            factors.append(schemas.ContributingFactor(
                name="Cargo Transit Delay Impact",
                weight=-cargo_penalty,
                impact="NEGATIVE",
                description=f"{len(delayed_cargo)} cargo consignment(s) destined for this expedition are currently delayed."
            ))
        else:
            factors.append(schemas.ContributingFactor(
                name="Cargo Supply Pipeline",
                weight=10.0,
                impact="POSITIVE",
                description="All allocated cargo assets are either delivered or in scheduled transit."
            ))

        # Factor 3: Inventory reserve coverage
        critical_inv = db.query(models.Inventory).filter(
            models.Inventory.expedition_id == exp.id,
            models.Inventory.status.in_(["CRITICAL", "OUT_OF_STOCK"])
        ).all()
        if critical_inv:
            inv_penalty = min(30.0, len(critical_inv) * 15.0)
            base_score = max(5.0, base_score - inv_penalty)
            factors.append(schemas.ContributingFactor(
                name="Supply Reserve Deficit",
                weight=-inv_penalty,
                impact="NEGATIVE",
                description=f"{len(critical_inv)} mission-critical inventory line item(s) breached safety threshold."
            ))

        # Factor 4: Personnel emergency telemetry
        personnel_sos = db.query(models.Personnel).filter(
            models.Personnel.expedition_id == exp.id,
            models.Personnel.status == "EMERGENCY"
        ).count()
        if personnel_sos > 0:
            base_score = max(5.0, base_score - 35.0)
            factors.append(schemas.ContributingFactor(
                name="Active Personnel SOS Alert",
                weight=-35.0,
                impact="NEGATIVE",
                description=f"{personnel_sos} deployed team member(s) actively reporting EMERGENCY telemetry status."
            ))

        final_score = round(min(100.0, max(0.0, base_score)), 1)
        
        # Determine readiness level using system settings thresholds
        warn_thresh = crud.get_setting_value(db, "readiness_warning_threshold", 70)
        crit_thresh = crud.get_setting_value(db, "readiness_critical_threshold", 50)
        if final_score >= 85:
            level = "READY"
        elif final_score >= warn_thresh:
            level = "ATTENTION"
        elif final_score >= crit_thresh:
            level = "AT_RISK"
        else:
            level = "CRITICAL"

        # Generate recommended actions
        actions = []
        if delayed_cargo:
            actions.append("Expedite supply vessel/airlift manifests for delayed cargo consignments.")
        if critical_inv:
            actions.append("Trigger emergency stock replenishment from Maitri / Cape Town staging depot.")
        if personnel_sos > 0:
            actions.append("Coordinate immediate SAR rescue sortie with regional response unit.")
        if not actions:
            actions.append("Maintain nominal operational monitoring and regular telemetry sync.")

        explanation = (
            f"Expedition is assessed as {level} ({final_score}%) based on "
            f"{len(factors)} operational factors across inventory, logistics, and personnel telemetry."
        )

        results.append(schemas.ExpeditionReadinessAnalysisOut(
            expedition_id=exp.id,
            expedition_name=exp.name,
            base_station=exp.base_station or exp.location or "Maitri Station",
            score=final_score,
            level=level,
            factors=factors,
            explanation=explanation,
            recommended_actions=actions
        ))

    return results

# ─── 2. INVENTORY SHORTAGE RISK ANALYSIS ──────────────────────────────────────

@router.get("/inventory-risk", response_model=List[schemas.InventoryRiskItemOut])
def get_inventory_risk_analysis(db: Session = Depends(get_db)):
    """
    Evaluates inventory stockout vulnerability using burn rates, available buffer ratios,
    and lead-time risk metrics. Enriched with real station burn rate and consumption trend
    data from DailyConsumptionRecord when StationResourceRequirement exists for an item.
    """
    items = db.query(models.Inventory).all()
    results = []

    # Build station intelligence lookup keyed by item_code for fast enrichment
    station_intel_raw = crud.get_station_resource_intelligence(db, station_id=None)
    # If multiple stations have the same item_code, use the highest-risk entry
    intel_by_code: dict = {}
    for si in station_intel_raw:
        code = si["item_code"]
        if code not in intel_by_code or si["risk_score"] > intel_by_code[code]["risk_score"]:
            intel_by_code[code] = si

    for item in items:
        factors = []
        deficit = max(0.0, item.minimum_quantity - item.quantity)

        # Base risk calculation
        risk_score = 10.0

        # Factor 1: Stock vs Threshold ratio
        if item.minimum_quantity > 0:
            ratio = item.quantity / item.minimum_quantity
            if ratio <= 0:
                risk_score += 65.0
                factors.append(schemas.ContributingFactor(
                    name="Complete Stock Depletion",
                    weight=65.0,
                    impact="NEGATIVE",
                    description="Zero quantity available at storage location."
                ))
            elif ratio <= 0.5:
                risk_score += 45.0
                factors.append(schemas.ContributingFactor(
                    name="Critical Reserve Breach",
                    weight=45.0,
                    impact="NEGATIVE",
                    description=f"Current stock is at {round(ratio * 100, 1)}% of safety threshold (Deficit: {deficit} {item.unit})."
                ))
            elif ratio < 1.0:
                risk_score += 25.0
                factors.append(schemas.ContributingFactor(
                    name="Below Safety Minimum",
                    weight=25.0,
                    impact="NEGATIVE",
                    description=f"Stock is below minimum required buffer (Deficit: {deficit} {item.unit})."
                ))
            else:
                factors.append(schemas.ContributingFactor(
                    name="Adequate Buffer",
                    weight=-10.0,
                    impact="POSITIVE",
                    description=f"Stock exceeds safety reserve by {round((ratio - 1) * 100, 1)}%."
                ))

        # Factor 2: Days remaining based on polar burn rate
        days = item.days_remaining if item.days_remaining is not None else 100
        if days < 20:
            risk_score += 25.0
            factors.append(schemas.ContributingFactor(
                name="Severe Runway Depletion",
                weight=25.0,
                impact="NEGATIVE",
                description=f"Estimated consumption runway is only {days} days."
            ))
        elif days < 45:
            risk_score += 15.0
            factors.append(schemas.ContributingFactor(
                name="Moderate Runway Warning",
                weight=15.0,
                impact="NEGATIVE",
                description=f"Estimated consumption runway is {days} days."
            ))

        # Factor 3: Category criticality
        if item.category in ["Medical", "Fuel"]:
            risk_score += 10.0
            factors.append(schemas.ContributingFactor(
                name="Life-Support Category Weight",
                weight=10.0,
                impact="NEGATIVE",
                description=f"{item.category} supplies have elevated operational criticality in polar winter."
            ))

        # Factor 4: Station intelligence enrichment (burn rate & trend from real records)
        si = intel_by_code.get(item.item_code)
        station_name = None
        burn_rate_text = None
        trend = None
        days_to_minimum = None
        forecast_status = None
        why_flagged = []

        if si:
            station_name = si["station_name"]
            burn_rate_text = si["burn_rate_text"]
            trend = si["trend"]
            days_to_minimum = si["days_to_minimum"]
            forecast_status = si["forecast_status"]
            why_flagged = si["why_flagged"]

            if si["has_sufficient_history"] and si["burn_rate_value"]:
                factors.append(schemas.ContributingFactor(
                    name="Real Station Burn Rate",
                    weight=5.0,
                    impact="NEUTRAL",
                    description=f"Station '{station_name}': {si['burn_rate_text']} (from {si['consumption_record_count']} actual consumption records)."
                ))
            else:
                factors.append(schemas.ContributingFactor(
                    name="Burn Rate Data",
                    weight=0.0,
                    impact="NEUTRAL",
                    description=f"Station '{station_name}': {si['burn_rate_text']}."
                ))

            if trend == "INCREASING":
                risk_score += 8.0
                factors.append(schemas.ContributingFactor(
                    name="Rising Consumption Trend",
                    weight=8.0,
                    impact="NEGATIVE",
                    description=f"Consumption is trending upward ({si.get('trend_pct', 0):+.1f}% vs prior period)."
                ))
            elif trend == "DECREASING":
                factors.append(schemas.ContributingFactor(
                    name="Declining Consumption Trend",
                    weight=-5.0,
                    impact="POSITIVE",
                    description=f"Consumption is trending downward ({si.get('trend_pct', 0):+.1f}% vs prior period)."
                ))

            if days_to_minimum is not None and days_to_minimum < 14 and days_to_minimum > 0:
                risk_score += 15.0
                factors.append(schemas.ContributingFactor(
                    name="Imminent Reserve Breach",
                    weight=15.0,
                    impact="NEGATIVE",
                    description=f"Station '{station_name}' minimum reserve will be reached in {days_to_minimum} days."
                ))
        else:
            why_flagged = [
                "No station resource requirement configured for this item",
                "Configure station requirements to enable burn rate and forecast analysis"
            ]

        final_risk = round(min(100.0, max(0.0, risk_score)), 1)

        crit_thresh = crud.get_setting_value(db, "automation_inventory_risk_critical_threshold", 75)
        high_thresh = crud.get_setting_value(db, "automation_inventory_risk_high_threshold", 50)

        if final_risk >= crit_thresh or item.status in ["CRITICAL", "OUT_OF_STOCK"]:
            risk_level = "CRITICAL"
            recommended_action = f"Initiate urgent airlift/traverse replenishment for {item.item_name} ({deficit} {item.unit} deficit)."
        elif final_risk >= high_thresh or item.status == "LOW_STOCK":
            risk_level = "HIGH"
            recommended_action = f"Flag {item.item_name} in next scheduled supply convoy manifest."
        elif final_risk >= 30:
            risk_level = "MEDIUM"
            recommended_action = f"Monitor burn rate at {item.location} weekly."
        else:
            risk_level = "LOW"
            recommended_action = "Nominal stock buffer. No immediate procurement action required."

        station_intel_str = ""
        if si and si["has_sufficient_history"]:
            station_intel_str = f" Burn rate: {si['burn_rate_text']}. Trend: {trend}."

        explanation = (
            f"Inventory item {item.item_code} evaluated at {final_risk}% risk ({risk_level}) "
            f"due to {item.quantity}/{item.minimum_quantity} {item.unit} available stock and {days} days runway.{station_intel_str}"
        )

        results.append(schemas.InventoryRiskItemOut(
            inventory_id=item.id,
            item_code=item.item_code,
            item_name=item.item_name,
            category=item.category,
            location=item.location,
            quantity=item.quantity,
            minimum_quantity=item.minimum_quantity,
            unit=item.unit,
            days_remaining=days,
            risk_score=final_risk,
            risk_level=risk_level,
            factors=factors,
            explanation=explanation,
            recommended_action=recommended_action,
            station_name=station_name,
            burn_rate_text=burn_rate_text,
            trend=trend,
            days_to_minimum=days_to_minimum,
            forecast_status=forecast_status,
            why_flagged=why_flagged,
        ))

    # Sort highest risk first
    results.sort(key=lambda x: x.risk_score, reverse=True)
    return results

# ─── 3. CARGO LOGISTICS RISK ANALYSIS ────────────────────────────────────────

@router.get("/cargo-risk", response_model=List[schemas.CargoRiskItemOut])
def get_cargo_risk_analysis(db: Session = Depends(get_db)):
    """
    Evaluates cargo transit risks, tracking delays, priority tiers, and cold-chain compliance.
    """
    cargo_items = db.query(models.Cargo).all()
    results = []

    for c in cargo_items:
        factors = []
        risk_score = 10.0

        if c.status == "Delivered":
            risk_score = 5.0
            factors.append(schemas.ContributingFactor(
                name="Delivered Asset",
                weight=-30.0,
                impact="POSITIVE",
                description="Consignment safely received at destination."
            ))
        else:
            # Factor 1: Status
            if c.status == "Delayed":
                risk_score += 45.0
                factors.append(schemas.ContributingFactor(
                    name="Active Logistics Delay",
                    weight=45.0,
                    impact="NEGATIVE",
                    description=f"Consignment flagged as Delayed at {c.current_location}."
                ))
            elif c.status == "In Transit":
                risk_score += 15.0
                factors.append(schemas.ContributingFactor(
                    name="In Transit Dwell Time",
                    weight=15.0,
                    impact="NEUTRAL",
                    description=f"Active movement via {c.transit_mode or 'Traverse'} ({c.stage or 'En Route'})."
                ))
            else:
                factors.append(schemas.ContributingFactor(
                    name="Staged Depot Storage",
                    weight=5.0,
                    impact="NEUTRAL",
                    description=f"Consignment safely staged in warehouse storage at {c.current_location}."
                ))

            # Factor 2: Priority tier
            if c.priority == "Critical":
                risk_score += 25.0
                factors.append(schemas.ContributingFactor(
                    name="Critical Mission Priority",
                    weight=25.0,
                    impact="NEGATIVE",
                    description="Highest priority logistics consignment."
                ))
            elif c.priority == "High":
                risk_score += 15.0
                factors.append(schemas.ContributingFactor(
                    name="High Priority Allocation",
                    weight=15.0,
                    impact="NEGATIVE",
                    description="High priority equipment shipment."
                ))
            else:
                factors.append(schemas.ContributingFactor(
                    name="Standard Priority Tier",
                    weight=0.0,
                    impact="NEUTRAL",
                    description=f"Routine priority tier ({c.priority})."
                ))

            # Factor 3: Cold-chain sensitive category
            if c.category in ["Medical", "Fuel"]:
                risk_score += 15.0
                factors.append(schemas.ContributingFactor(
                    name="Cold-Chain / Hazard Vulnerability",
                    weight=15.0,
                    impact="NEGATIVE",
                    description=f"Category {c.category} requires temperature regulation (Log: {c.temperature_log})."
                ))

        final_risk = round(min(100.0, max(0.0, risk_score)), 1)
        
        crit_thresh = crud.get_setting_value(db, "automation_cargo_risk_critical_threshold", 70)
        high_thresh = crud.get_setting_value(db, "automation_cargo_risk_high_threshold", 45)

        if final_risk >= crit_thresh:
            risk_level = "CRITICAL"
            recommended_action = f"Reroute or expedite consignment {c.cargo_code} via priority air-traverse link."
        elif final_risk >= high_thresh:
            risk_level = "HIGH"
            recommended_action = f"Contact carrier for {c.cargo_code} at {c.current_location} to confirm updated ETA."
        elif final_risk >= 25:
            risk_level = "MEDIUM"
            recommended_action = f"Monitor checkpoint check-in for {c.cargo_code} in transit to {c.destination}."
        else:
            risk_level = "LOW"
            recommended_action = "Nominal transit progress. No intervention required."

        explanation = (
            f"Cargo {c.cargo_code} scored at {final_risk}% risk ({risk_level}) "
            f"based on status '{c.status}', priority tier '{c.priority}', and stage '{c.stage}'."
        )

        results.append(schemas.CargoRiskItemOut(
            cargo_id=c.id,
            cargo_code=c.cargo_code,
            name=c.name,
            category=c.category,
            status=c.status,
            priority=c.priority,
            destination=c.destination,
            current_location=c.current_location,
            temperature_log=c.temperature_log,
            risk_score=final_risk,
            risk_level=risk_level,
            factors=factors,
            explanation=explanation,
            recommended_action=recommended_action
        ))

    results.sort(key=lambda x: x.risk_score, reverse=True)
    return results

# ─── 4. PERSONNEL OPERATIONAL RISK ANALYSIS ──────────────────────────────────

@router.get("/personnel-risk", response_model=List[schemas.PersonnelRiskItemOut])
def get_personnel_risk_analysis(db: Session = Depends(get_db)):
    """
    Evaluates operational safety risk of field deployments (telemetry battery reserve,
    isolation of current sector, and active SOS states) without making medical diagnoses.
    """
    personnel = db.query(models.Personnel).all()
    results = []

    for p in personnel:
        factors = []
        risk_score = 10.0

        # Factor 1: Operational Status
        if p.status == "EMERGENCY":
            risk_score += 75.0
            factors.append(schemas.ContributingFactor(
                name="Active Distress Telemetry (SOS)",
                weight=75.0,
                impact="NEGATIVE",
                description="Personnel is currently flagged in active EMERGENCY state."
            ))
        elif p.status == "FIELD":
            risk_score += 35.0
            factors.append(schemas.ContributingFactor(
                name="Remote Field Deployment",
                weight=35.0,
                impact="NEGATIVE",
                description=f"Deployed in sub-zero polar field environment at {p.current_location}."
            ))
        elif p.status == "IN_TRANSIT":
            risk_score += 25.0
            factors.append(schemas.ContributingFactor(
                name="Traverse Transit Exposure",
                weight=25.0,
                impact="NEGATIVE",
                description="Currently moving on polar traverse or flight corridor."
            ))
        else:
            factors.append(schemas.ContributingFactor(
                name="Habitat Base Station Safety",
                weight=-10.0,
                impact="POSITIVE",
                description=f"Stationed inside controlled habitat at {p.current_location}."
            ))

        # Factor 2: Device Battery Telemetry
        try:
            battery_val = int(str(p.battery or '85').replace('%', ''))
            if battery_val < 25:
                risk_score += 30.0
                factors.append(schemas.ContributingFactor(
                    name="Critical Telemetry Battery Depletion",
                    weight=30.0,
                    impact="NEGATIVE",
                    description=f"Locator beacon battery is at critical {battery_val}% in sub-zero conditions."
                ))
            elif battery_val < 50:
                risk_score += 15.0
                factors.append(schemas.ContributingFactor(
                    name="Low Beacon Battery Warning",
                    weight=15.0,
                    impact="NEGATIVE",
                    description=f"Locator beacon battery is at {battery_val}%."
                ))
        except Exception:
            pass

        final_risk = round(min(100.0, max(0.0, risk_score)), 1)
        
        if final_risk >= 75 or p.status == "EMERGENCY":
            risk_level = "CRITICAL"
            recommended_action = f"Initiate immediate SAR vector check and satellite radio rendezvous for {p.name}."
        elif final_risk >= 50:
            risk_level = "HIGH"
            recommended_action = f"Verify hourly radio check-in and recharge beacon for {p.name} ({p.current_location})."
        elif final_risk >= 30:
            risk_level = "MEDIUM"
            recommended_action = f"Maintain standard 4-hour scheduled position telemetry for {p.name}."
        else:
            risk_level = "LOW"
            recommended_action = "Nominal station telemetry. No operational intervention needed."

        explanation = (
            f"Personnel {p.personnel_code} ({p.name}) scored at {final_risk}% operational risk ({risk_level}) "
            f"due to status '{p.status}' and location '{p.current_location}'."
        )

        results.append(schemas.PersonnelRiskItemOut(
            personnel_id=p.id,
            personnel_code=p.personnel_code,
            name=p.name,
            role=p.role,
            status=p.status,
            current_location=p.current_location,
            battery=p.battery or "85%",
            operational_risk_score=final_risk,
            risk_level=risk_level,
            factors=factors,
            explanation=explanation,
            recommended_action=recommended_action
        ))

    results.sort(key=lambda x: x.operational_risk_score, reverse=True)
    return results

# ─── 5. EMERGENCY INCIDENT PRIORITIZATION ────────────────────────────────────

@router.get("/emergency-priority", response_model=List[schemas.EmergencyPriorityItemOut])
def get_emergency_priority_queue(db: Session = Depends(get_db)):
    """
    Ranks all active emergency incidents according to explainable priority scoring
    (severity weight, unassigned latency, human life involvement, triage status).
    """
    active_incidents = db.query(models.Incident).filter(
        ~models.Incident.status.in_(["RESOLVED", "CANCELLED"])
    ).all()

    scored_items = []

    for inc in active_incidents:
        factors = []
        score = 0.0

        # Factor 1: Severity
        sev = (inc.severity or "HIGH").upper()
        if sev == "CRITICAL":
            score += 45.0
            factors.append(schemas.ContributingFactor(
                name="CRITICAL Severity Weight",
                weight=45.0,
                impact="NEGATIVE",
                description="Life-safety or major asset emergency requiring instantaneous response."
            ))
        elif sev == "HIGH":
            score += 30.0
            factors.append(schemas.ContributingFactor(
                name="HIGH Severity Weight",
                weight=30.0,
                impact="NEGATIVE",
                description="High-risk operational disruption or vehicle failure."
            ))
        elif sev == "MEDIUM":
            score += 15.0
            factors.append(schemas.ContributingFactor(
                name="MEDIUM Severity Weight",
                weight=15.0,
                impact="NEUTRAL",
                description="Equipment or comms downlink disruption."
            ))
        else:
            score += 5.0
            factors.append(schemas.ContributingFactor(
                name="LOW Severity Baseline",
                weight=5.0,
                impact="NEUTRAL",
                description="Advisory level event."
            ))

        # Factor 2: Unassigned response unit penalty
        if not inc.assigned_unit_id:
            score += 30.0
            factors.append(schemas.ContributingFactor(
                name="Unassigned Response Unit Backlog",
                weight=30.0,
                impact="NEGATIVE",
                description="Incident does not yet have a dedicated SAR / response unit assigned."
            ))
        else:
            factors.append(schemas.ContributingFactor(
                name="Unit Assigned",
                weight=-10.0,
                impact="POSITIVE",
                description=f"Assigned unit {inc.assigned_unit.unit_code if inc.assigned_unit else 'SAR'} allocated."
            ))

        # Factor 3: Personnel involved
        if inc.personnel_id:
            score += 20.0
            factors.append(schemas.ContributingFactor(
                name="Direct Personnel Involvement",
                weight=20.0,
                impact="NEGATIVE",
                description=f"Incident involves deployed personnel {inc.personnel.name if inc.personnel else ''}."
            ))

        # Factor 4: Triage latency
        if inc.status == "REPORTED":
            score += 15.0
            factors.append(schemas.ContributingFactor(
                name="Awaiting Initial Commander Triage",
                weight=15.0,
                impact="NEGATIVE",
                description="Incident is currently in REPORTED status awaiting acknowledgment/triage."
            ))
        elif inc.status == "ACKNOWLEDGED":
            score += 10.0
            factors.append(schemas.ContributingFactor(
                name="Pending Dispatch Order",
                weight=10.0,
                impact="NEUTRAL",
                description="Incident acknowledged and awaiting unit dispatch."
            ))

        final_score = round(min(100.0, max(0.0, score)), 1)
        
        if not inc.assigned_unit_id:
            recommended_action = f"Assign closest available response unit to {inc.incident_code} ({inc.location_name})."
        elif inc.status in ["REPORTED", "ACKNOWLEDGED", "TRIAGED"]:
            recommended_action = f"Execute dispatch order for assigned unit to vector {inc.location_name}."
        else:
            recommended_action = f"Monitor live field SAR mission progress for {inc.incident_code}."

        explanation = (
            f"Incident {inc.incident_code} ranked with urgency score {final_score}/100 "
            f"based on {sev} severity, status '{inc.status}', and {'unassigned' if not inc.assigned_unit_id else 'assigned'} response unit."
        )

        scored_items.append({
            "incident": inc,
            "score": final_score,
            "factors": factors,
            "explanation": explanation,
            "recommended_action": recommended_action
        })

    # Sort descending by priority score
    scored_items.sort(key=lambda x: x["score"], reverse=True)

    results = []
    for rank, item in enumerate(scored_items, start=1):
        inc = item["incident"]
        results.append(schemas.EmergencyPriorityItemOut(
            incident_id=inc.id,
            incident_code=inc.incident_code,
            title=inc.title,
            severity=inc.severity,
            status=inc.status,
            location_name=inc.location_name,
            priority_rank=rank,
            priority_score=item["score"],
            factors=item["factors"],
            explanation=item["explanation"],
            recommended_action=item["recommended_action"],
            has_assigned_unit=bool(inc.assigned_unit_id),
            assigned_unit_code=inc.assigned_unit.unit_code if inc.assigned_unit else None
        ))

    return results

# ─── 6. RESOURCE RECOMMENDATIONS (OPERATOR CONTROLLED) ───────────────────────

@router.get("/recommendations", response_model=List[schemas.AutomationRecommendationOut])
def get_automation_recommendations(db: Session = Depends(get_db)):
    """
    Generates ranked, operator-controlled response unit recommendations for active incidents.
    Never dispatches automatically; provides explicit scoring, distance, and capability matches.
    """
    active_incidents = db.query(models.Incident).filter(
        ~models.Incident.status.in_(["RESOLVED", "CANCELLED"])
    ).all()

    results = []
    for inc in active_incidents:
        recs = crud.recommend_response_units(db, inc.id)
        results.append(schemas.AutomationRecommendationOut(
            incident_id=inc.id,
            incident_code=inc.incident_code,
            incident_title=inc.title,
            incident_severity=inc.severity,
            location_name=inc.location_name,
            recommended_units=recs
        ))

    return results

# ─── 7. AUTOMATION EXECUTIVE SUMMARY ─────────────────────────────────────────

@router.get("/summary", response_model=schemas.AutomationSummaryOut)
def get_automation_summary(db: Session = Depends(get_db)):
    """
    Executive consolidated analysis covering overall polar fleet readiness index,
    active critical risks, and top priority operator action items.
    """
    readiness_list = get_expedition_readiness_analysis(db)
    inventory_risks = get_inventory_risk_analysis(db)
    cargo_risks = get_cargo_risk_analysis(db)
    personnel_risks = get_personnel_risk_analysis(db)
    emergency_priorities = get_emergency_priority_queue(db)

    # 1. Overall fleet readiness
    if readiness_list:
        overall_readiness = round(sum(r.score for r in readiness_list) / len(readiness_list), 1)
    else:
        overall_readiness = 90.0

    # 2. Risk tallies
    crit_inv = sum(1 for i in inventory_risks if i.risk_level == "CRITICAL")
    crit_cargo = sum(1 for c in cargo_risks if c.risk_level == "CRITICAL")
    crit_pers = sum(1 for p in personnel_risks if p.risk_level == "CRITICAL")
    crit_em = sum(1 for e in emergency_priorities if e.priority_score >= 70)

    total_critical = crit_inv + crit_cargo + crit_pers + crit_em

    high_inv = sum(1 for i in inventory_risks if i.risk_level == "HIGH")
    high_cargo = sum(1 for c in cargo_risks if c.risk_level == "HIGH")
    high_pers = sum(1 for p in personnel_risks if p.risk_level == "HIGH")
    high_em = sum(1 for e in emergency_priorities if 50 <= e.priority_score < 70)

    total_high = high_inv + high_cargo + high_pers + high_em

    # Composite risk index (0 to 100, where lower is safer)
    risk_index = round(min(100.0, (total_critical * 20.0) + (total_high * 8.0)), 1)

    # Top priority action items
    actions = []
    is_auto_enabled = crud.get_setting_value(db, "automation_enabled", True)
    if not is_auto_enabled:
        actions.append("Smart automation engine paused via system configuration. Routine monitoring active.")

    for em in emergency_priorities[:2]:
        actions.append(f"Emergency SAR: {em.recommended_action}")
    for inv in inventory_risks[:2]:
        if inv.risk_level in ["CRITICAL", "HIGH"]:
            actions.append(f"Supply Logistics: {inv.recommended_action}")
    for crg in cargo_risks[:1]:
        if crg.risk_level in ["CRITICAL", "HIGH"]:
            actions.append(f"Cargo Pipeline: {crg.recommended_action}")

    if not actions:
        actions.append("All polar expedition subsystems operating within nominal safety parameters.")

    return schemas.AutomationSummaryOut(
        overall_fleet_readiness=overall_readiness,
        overall_risk_index=risk_index,
        critical_risks_count=total_critical,
        high_risks_count=total_high,
        expeditions_analyzed=len(readiness_list),
        inventory_items_at_risk=crit_inv + high_inv,
        delayed_cargo_count=sum(1 for c in cargo_risks if c.status == "Delayed"),
        personnel_operational_alerts=crit_pers + high_pers,
        active_emergency_count=len(emergency_priorities),
        top_priority_actions=actions[:5],
        analyzed_at=_get_current_timestamp()
    )
