import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from . import models, schemas

# --- HELPER: Haversine Distance Calculation ---
def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate approximate great-circle distance in kilometers between two geographic points."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 99999.0
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (ValueError, TypeError):
        return 99999.0

    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


# --- HELPER: Compute Inventory Status ---
def compute_inventory_status(
    quantity: float, 
    minimum_quantity: float,
    low_stock_ratio: float = 1.5,
    critical_ratio: float = 1.0
) -> str:
    """
    Business Rules for Smart Inventory:
    quantity == 0 -> OUT_OF_STOCK
    quantity < minimum_quantity * critical_ratio -> CRITICAL
    quantity >= minimum_quantity * critical_ratio and quantity <= minimum_quantity * low_stock_ratio -> LOW_STOCK
    otherwise -> NORMAL
    """
    q = float(quantity or 0.0)
    min_q = float(minimum_quantity or 0.0)
    crit_r = float(critical_ratio if critical_ratio is not None else 1.0)
    low_r = float(low_stock_ratio if low_stock_ratio is not None else 1.5)
    
    if q <= 0.0:
        return "OUT_OF_STOCK"
    elif q < min_q * crit_r:
        return "CRITICAL"
    elif q <= min_q * low_r:
        return "LOW_STOCK"
    else:
        return "NORMAL"

def get_current_timestamp() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d %H:%M UTC")

def map_status_to_stage(status: str) -> str:
    s = (status or "").lower()
    if "prepar" in s or "warehouse" in s:
        return "Warehouse"
    elif "port" in s or "custom" in s:
        return "Port"
    elif "load" in s or "ship" in s or "transit" in s:
        return "Ship"
    elif "antarctica" in s or "ice" in s or "shelf" in s:
        return "Antarctica"
    elif "deliver" in s or "station" in s or "base" in s:
        return "Research Station"
    return "Warehouse"


# --- EXPEDITIONS CRUD ---
def get_expeditions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Expedition).offset(skip).limit(limit).all()

def get_expedition(db: Session, expedition_id: int):
    return db.query(models.Expedition).filter(models.Expedition.id == expedition_id).first()

def create_expedition(db: Session, exp: schemas.ExpeditionCreate):
    db_exp = models.Expedition(**exp.model_dump())
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    return db_exp


# --- CARGO MOVEMENT CRUD ---
def create_cargo_movement(
    db: Session, 
    cargo_id: int, 
    status: str, 
    location: str, 
    notes: str = None, 
    timestamp: str = None
):
    if not timestamp:
        timestamp = get_current_timestamp()
    movement = models.CargoMovement(
        cargo_id=cargo_id,
        status=status,
        location=location,
        timestamp=timestamp,
        notes=notes
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement

def get_cargo_movements(db: Session, cargo_id: int):
    return db.query(models.CargoMovement).filter(
        models.CargoMovement.cargo_id == cargo_id
    ).order_by(models.CargoMovement.id.desc()).all()

def get_recent_cargo_movements(db: Session, limit: int = 10):
    return db.query(models.CargoMovement).order_by(
        models.CargoMovement.id.desc()
    ).limit(limit).all()


# --- CARGO CRUD ---
def get_cargo_list(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    status: str = None, 
    priority: str = None, 
    expedition_id: int = None,
    search: str = None
):
    query = db.query(models.Cargo)

    if status and status.upper() != "ALL":
        query = query.filter(models.Cargo.status.ilike(f"%{status}%"))
    if priority and priority.upper() != "ALL":
        query = query.filter(models.Cargo.priority.ilike(f"%{priority}%"))
    if expedition_id:
        query = query.filter(models.Cargo.expedition_id == expedition_id)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                models.Cargo.cargo_code.ilike(search_fmt),
                models.Cargo.name.ilike(search_fmt),
                models.Cargo.category.ilike(search_fmt),
                models.Cargo.destination.ilike(search_fmt),
                models.Cargo.origin.ilike(search_fmt)
            )
        )

    return query.offset(skip).limit(limit).all()

def get_cargo(db: Session, cargo_id: int):
    return db.query(models.Cargo).filter(models.Cargo.id == cargo_id).first()

def get_cargo_by_code(db: Session, cargo_code: str):
    return db.query(models.Cargo).filter(models.Cargo.cargo_code == cargo_code).first()

def create_cargo(db: Session, cargo: schemas.CargoCreate):
    cargo_data = cargo.model_dump()
    if not cargo_data.get("current_location"):
        cargo_data["current_location"] = cargo_data.get("origin", "Warehouse")
    if not cargo_data.get("stage"):
        cargo_data["stage"] = map_status_to_stage(cargo_data.get("status", "Preparing"))
    if not cargo_data.get("last_updated"):
        cargo_data["last_updated"] = get_current_timestamp()

    db_cargo = models.Cargo(**cargo_data)
    db.add(db_cargo)
    db.commit()
    db.refresh(db_cargo)

    # Automatically create initial movement record
    create_cargo_movement(
        db=db,
        cargo_id=db_cargo.id,
        status=db_cargo.status,
        location=db_cargo.current_location,
        notes=db_cargo.notes or f"Cargo {db_cargo.cargo_code} registered in POLAR-X asset inventory."
    )

    return db_cargo

def update_cargo(db: Session, cargo_id: int, cargo_update: schemas.CargoUpdate):
    db_cargo = get_cargo(db, cargo_id)
    if not db_cargo:
        return None
    
    update_data = cargo_update.model_dump(exclude_unset=True)
    old_status = db_cargo.status
    old_location = db_cargo.current_location

    for key, value in update_data.items():
        setattr(db_cargo, key, value)

    # Auto-adjust stage & last_updated
    if "status" in update_data:
        db_cargo.stage = map_status_to_stage(db_cargo.status)
    db_cargo.last_updated = get_current_timestamp()

    db.commit()
    db.refresh(db_cargo)

    # If status, location, or notes changed, record a new movement history entry
    status_changed = "status" in update_data and update_data["status"] != old_status
    location_changed = "current_location" in update_data and update_data["current_location"] != old_location
    
    if status_changed or location_changed or "notes" in update_data:
        note_desc = update_data.get("notes") or f"Status updated to '{db_cargo.status}' at location: {db_cargo.current_location}"
        create_cargo_movement(
            db=db,
            cargo_id=db_cargo.id,
            status=db_cargo.status,
            location=db_cargo.current_location or "In Transit",
            notes=note_desc
        )

    return db_cargo

def get_cargo_detail(db: Session, cargo_id: int):
    cargo = get_cargo(db, cargo_id)
    if not cargo:
        return None
    
    exp_name = cargo.expedition.name if cargo.expedition else "General Polar Inventory"
    movements = get_cargo_movements(db, cargo_id)

    return schemas.CargoDetailOut(
        id=cargo.id,
        cargo_code=cargo.cargo_code,
        name=cargo.name,
        category=cargo.category,
        weight=cargo.weight,
        origin=cargo.origin,
        destination=cargo.destination,
        status=cargo.status,
        priority=cargo.priority,
        transit_mode=cargo.transit_mode,
        rfid_tag=cargo.rfid_tag,
        temperature_log=cargo.temperature_log,
        eta=cargo.eta,
        current_location=cargo.current_location,
        last_updated=cargo.last_updated,
        notes=cargo.notes,
        stage=cargo.stage,
        expedition_id=cargo.expedition_id,
        expedition_name=exp_name,
        movements=[schemas.CargoMovementOut.model_validate(m) for m in movements]
    )

def get_cargo_summary_stats(db: Session):
    total = db.query(models.Cargo).count()
    in_transit = db.query(models.Cargo).filter(models.Cargo.status == "In Transit").count()
    delivered = db.query(models.Cargo).filter(models.Cargo.status == "Delivered").count()
    high_priority = db.query(models.Cargo).filter(
        models.Cargo.priority.in_(["High", "Critical"])
    ).count()
    delayed = db.query(models.Cargo).filter(models.Cargo.status == "Delayed").count()
    preparing = db.query(models.Cargo).filter(models.Cargo.status == "Preparing").count()
    at_port = db.query(models.Cargo).filter(models.Cargo.status == "At Port").count()
    loaded = db.query(models.Cargo).filter(models.Cargo.status == "Loaded").count()

    return schemas.CargoSummaryStatsOut(
        total_cargo=total,
        in_transit=in_transit,
        delivered=delivered,
        high_priority=high_priority,
        delayed=delayed,
        preparing=preparing,
        at_port=at_port,
        loaded=loaded
    )

def get_cargo_qr_data(db: Session, cargo_id: int):
    cargo = get_cargo(db, cargo_id)
    if not cargo:
        return None
    
    payload = f"POLAR-X:{cargo.cargo_code}|{cargo.name}|{cargo.weight}|{cargo.origin}->{cargo.destination}|PRIORITY:{cargo.priority}|STATUS:{cargo.status}"

    return schemas.CargoQRDataOut(
        cargo_id=cargo.id,
        cargo_code=cargo.cargo_code,
        name=cargo.name,
        category=cargo.category,
        weight=cargo.weight,
        origin=cargo.origin,
        destination=cargo.destination,
        status=cargo.status,
        priority=cargo.priority,
        current_location=cargo.current_location or cargo.origin,
        last_updated=cargo.last_updated or "Recent",
        qr_payload=payload
    )

def get_cargo_locations(db: Session):
    """Retrieve cargo assets with their geographic coordinates and metadata for map overlay."""
    cargo_list = db.query(models.Cargo).all()
    results = []
    for c in cargo_list:
        exp_name = c.expedition.name if c.expedition else "General Polar Inventory"
        results.append(
            schemas.CargoLocationMapOut(
                id=c.id,
                cargo_code=c.cargo_code,
                name=c.name,
                category=c.category,
                weight=c.weight,
                origin=c.origin,
                destination=c.destination,
                status=c.status,
                priority=c.priority,
                current_location=c.current_location or c.origin,
                latitude=c.latitude,
                longitude=c.longitude,
                expedition_id=c.expedition_id,
                expedition_name=exp_name,
                last_updated=c.last_updated or "Recent"
            )
        )
    return results


# --- SMART INVENTORY ALERTS HELPER ---
def check_and_trigger_inventory_alert(
    db: Session, 
    item: models.Inventory, 
    prev_status: str, 
    new_status: str, 
    reason: str = None
):
    if prev_status == new_status:
        return None
    
    if new_status not in ["LOW_STOCK", "CRITICAL", "OUT_OF_STOCK"]:
        return None

    timestamp = get_current_timestamp()
    
    if new_status == "OUT_OF_STOCK":
        title = f"STOCKOUT ALERT — {item.item_name} ({item.item_code})"
        message = f"Inventory item {item.item_name} [{item.item_code}] is completely OUT OF STOCK (0.0 {item.unit}) at {item.location}."
        if reason:
            message += f" Reason: {reason}."
        severity = "CRITICAL"
        action = "Initiate emergency cold-chain resupply or inter-station resource transfer immediately."
    elif new_status == "CRITICAL":
        title = f"Critical Reserve Breach — {item.item_name} ({item.item_code})"
        message = f"Stock level for {item.item_name} is at {item.quantity} {item.unit}, which is below the safety reserve threshold of {item.minimum_quantity} {item.unit} at {item.location}."
        severity = "CRITICAL"
        action = f"Prioritize resupply order. Restrict non-essential usage at {item.location}."
    elif new_status == "LOW_STOCK":
        title = f"Low Stock Warning — {item.item_name} ({item.item_code})"
        message = f"{item.item_name} has reached low-stock level ({item.quantity} {item.unit} remaining, safety baseline: {item.minimum_quantity} {item.unit}) at {item.location}."
        severity = "WARNING"
        action = "Schedule standard replenishment in upcoming convoy traverse."
    else:
        return None

    alert = models.Alert(
        type="Resource",
        title=title,
        message=message,
        severity=severity,
        timestamp=timestamp,
        status="ACTIVE",
        source=f"Inventory Monitor [{item.item_code}]",
        action_required=action,
        coordinates=item.location
    )
    db.add(alert)
    return alert


# --- INVENTORY TRANSACTION CRUD ---
def create_inventory_transaction(
    db: Session,
    inventory_id: int,
    transaction_type: str,
    quantity: float,
    previous_quantity: float,
    new_quantity: float,
    reason: str = None,
    user: str = "Station Logistics Officer",
    timestamp: str = None
):
    if not timestamp:
        timestamp = get_current_timestamp()
    tx = models.InventoryTransaction(
        inventory_id=inventory_id,
        transaction_type=transaction_type,
        quantity=quantity,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        timestamp=timestamp,
        reason=reason,
        user=user or "Station Logistics Officer"
    )
    db.add(tx)
    return tx

def get_inventory_transactions(db: Session, inventory_id: int, limit: int = 50):
    return db.query(models.InventoryTransaction).filter(
        models.InventoryTransaction.inventory_id == inventory_id
    ).order_by(models.InventoryTransaction.id.desc()).limit(limit).all()


# --- INVENTORY CRUD ---
def get_inventory_list(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    status: str = None,
    category: str = None,
    expedition_id: int = None,
    search: str = None
):
    query = db.query(models.Inventory)

    if status and status.upper() != "ALL":
        query = query.filter(models.Inventory.status == status.upper())
    if category and category.upper() != "ALL":
        query = query.filter(models.Inventory.category.ilike(f"%{category}%"))
    if expedition_id:
        query = query.filter(models.Inventory.expedition_id == expedition_id)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                models.Inventory.item_code.ilike(s),
                models.Inventory.item_name.ilike(s),
                models.Inventory.category.ilike(s),
                models.Inventory.location.ilike(s)
            )
        )

    return query.order_by(models.Inventory.id.asc()).offset(skip).limit(limit).all()

def get_inventory_item(db: Session, item_id: int):
    return db.query(models.Inventory).filter(models.Inventory.id == item_id).first()

def get_inventory_item_by_code(db: Session, item_code: str):
    return db.query(models.Inventory).filter(models.Inventory.item_code == item_code).first()

def get_inventory_detail(db: Session, item_id: int):
    item = get_inventory_item(db, item_id)
    if not item:
        return None
    exp_name = item.expedition.name if item.expedition else "Station General Buffer"
    transactions = db.query(models.InventoryTransaction).filter(
        models.InventoryTransaction.inventory_id == item_id
    ).order_by(models.InventoryTransaction.id.desc()).all()

    return schemas.InventoryDetailOut(
        id=item.id,
        item_code=item.item_code,
        item_name=item.item_name,
        category=item.category,
        quantity=item.quantity,
        minimum_quantity=item.minimum_quantity,
        unit=item.unit,
        location=item.location,
        burn_rate=item.burn_rate,
        days_remaining=item.days_remaining,
        status=item.status,
        created_at=item.created_at,
        updated_at=item.updated_at,
        expedition_id=item.expedition_id,
        expedition_name=exp_name,
        transactions=[schemas.InventoryTransactionOut.model_validate(t) for t in transactions]
    )

def create_inventory(db: Session, item: schemas.InventoryCreate):
    timestamp = get_current_timestamp()
    qty = max(0.0, float(item.quantity))
    min_qty = max(0.0, float(item.minimum_quantity))
    status = compute_inventory_status(qty, min_qty)

    db_item = models.Inventory(
        item_code=item.item_code,
        item_name=item.item_name,
        category=item.category or "Other",
        quantity=qty,
        minimum_quantity=min_qty,
        unit=item.unit or "Units",
        location=item.location or "Maitri Storage Bunker",
        burn_rate=item.burn_rate or "Standard",
        days_remaining=item.days_remaining or 100,
        expedition_id=item.expedition_id,
        status=status,
        created_at=timestamp,
        updated_at=timestamp
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    # Initial transaction record
    create_inventory_transaction(
        db=db,
        inventory_id=db_item.id,
        transaction_type="STOCK_IN" if db_item.quantity > 0 else "ADJUSTMENT",
        quantity=db_item.quantity,
        previous_quantity=0.0,
        new_quantity=db_item.quantity,
        reason="Initial inventory registration in POLAR-X catalog.",
        user="System Registration",
        timestamp=timestamp
    )

    # Check and trigger alert if initialized in problematic state
    check_and_trigger_inventory_alert(
        db=db,
        item=db_item,
        prev_status="NORMAL",
        new_status=status,
        reason="Initial registration status"
    )

    db.commit()
    db.refresh(db_item)
    return db_item

def update_inventory(db: Session, item_id: int, item_update: schemas.InventoryUpdate):
    db_item = get_inventory_item(db, item_id)
    if not db_item:
        return None
    
    prev_status = db_item.status
    update_data = item_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_item, key, value)
        
    ls_r = get_setting_value(db, "inventory_low_stock_ratio", 1.5)
    cr_r = get_setting_value(db, "inventory_critical_ratio", 1.0)
    db_item.status = compute_inventory_status(db_item.quantity, db_item.minimum_quantity, low_stock_ratio=ls_r, critical_ratio=cr_r)
    db_item.updated_at = get_current_timestamp()

    # Trigger alert if status transitioned
    check_and_trigger_inventory_alert(
        db=db,
        item=db_item,
        prev_status=prev_status,
        new_status=db_item.status,
        reason="Item parameters updated"
    )

    db.commit()
    db.refresh(db_item)
    return db_item

def update_inventory_stock(
    db: Session, 
    item_id: int, 
    stock_update: schemas.InventoryStockUpdate
):
    db_item = get_inventory_item(db, item_id)
    if not db_item:
        return None, "Item not found"

    qty = float(stock_update.quantity)
    tx_type = stock_update.transaction_type.upper()

    if qty <= 0 and tx_type in ["STOCK_IN", "STOCK_OUT"]:
        return None, "Quantity must be greater than 0"
    
    prev_qty = db_item.quantity
    prev_status = db_item.status

    if tx_type == "STOCK_IN":
        new_qty = prev_qty + qty
    elif tx_type == "STOCK_OUT":
        if qty > prev_qty:
            return None, f"Insufficient stock: Requested {qty} {db_item.unit}, but only {prev_qty} {db_item.unit} available."
        new_qty = prev_qty - qty
    elif tx_type == "ADJUSTMENT":
        if qty < 0:
            return None, "Adjusted stock quantity cannot be negative"
        new_qty = qty
    else:
        return None, f"Invalid transaction type: '{stock_update.transaction_type}'. Allowed types: STOCK_IN, STOCK_OUT, ADJUSTMENT."

    new_qty = round(max(0.0, new_qty), 3)
    ls_r = get_setting_value(db, "inventory_low_stock_ratio", 1.5)
    cr_r = get_setting_value(db, "inventory_critical_ratio", 1.0)
    new_status = compute_inventory_status(new_qty, db_item.minimum_quantity, low_stock_ratio=ls_r, critical_ratio=cr_r)
    timestamp = get_current_timestamp()

    db_item.quantity = new_qty
    db_item.status = new_status
    db_item.updated_at = timestamp

    # Create transaction history
    create_inventory_transaction(
        db=db,
        inventory_id=db_item.id,
        transaction_type=tx_type,
        quantity=qty,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reason=stock_update.reason or f"{tx_type} operation performed",
        user=stock_update.user or "Station Logistics Officer",
        timestamp=timestamp
    )

    # Trigger smart alert if transitioned to problematic state
    check_and_trigger_inventory_alert(
        db=db,
        item=db_item,
        prev_status=prev_status,
        new_status=new_status,
        reason=stock_update.reason
    )

    db.commit()
    db.refresh(db_item)
    return db_item, None

def get_inventory_summary_stats(db: Session):
    total = db.query(models.Inventory).count()
    low_stock = db.query(models.Inventory).filter(models.Inventory.status == "LOW_STOCK").count()
    critical = db.query(models.Inventory).filter(models.Inventory.status == "CRITICAL").count()
    out_of_stock = db.query(models.Inventory).filter(models.Inventory.status == "OUT_OF_STOCK").count()
    normal = db.query(models.Inventory).filter(models.Inventory.status == "NORMAL").count()
    total_qty = db.query(func.sum(models.Inventory.quantity)).scalar() or 0.0

    return schemas.InventorySummaryStatsOut(
        total_items=total,
        low_stock=low_stock,
        critical=critical,
        out_of_stock=out_of_stock,
        normal=normal,
        total_quantity=round(float(total_qty), 1)
    )

def get_expedition_readiness(db: Session, expedition_id: int = None):
    expeditions_query = db.query(models.Expedition)
    if expedition_id:
        expeditions_query = expeditions_query.filter(models.Expedition.id == expedition_id)
    
    expeditions = expeditions_query.all()
    results = []

    for exp in expeditions:
        reqs = db.query(models.ExpeditionInventoryRequirement).filter(
            models.ExpeditionInventoryRequirement.expedition_id == exp.id
        ).all()

        req_details = []
        fulfilled_count = 0
        critical_shortages = 0
        total_pct = 0.0

        for r in reqs:
            matching_items = db.query(models.Inventory).filter(
                or_(
                    models.Inventory.expedition_id == exp.id,
                    models.Inventory.category.ilike(f"%{r.category}%")
                )
            ).all()

            if r.item_name:
                filtered_items = [i for i in matching_items if r.item_name.lower() in i.item_name.lower() or r.category.lower() in i.category.lower()]
                if filtered_items:
                    matching_items = filtered_items

            avail = sum(i.quantity for i in matching_items) if matching_items else 0.0
            req_qty = max(0.1, float(r.required_quantity))
            fulfillment = round(min(100.0, (avail / req_qty) * 100.0), 1)

            if avail >= r.required_quantity:
                status = "READY"
                fulfilled_count += 1
            else:
                status = "SHORTAGE"
                if avail < r.required_quantity * 0.5:
                    critical_shortages += 1

            total_pct += min(100.0, (avail / req_qty) * 100.0)

            req_details.append(
                schemas.RequirementDetailOut(
                    id=r.id,
                    expedition_id=r.expedition_id,
                    category=r.category,
                    item_name=r.item_name,
                    required_quantity=r.required_quantity,
                    available_quantity=round(avail, 1),
                    unit=r.unit,
                    status=status,
                    fulfillment_percentage=fulfillment
                )
            )

        total_reqs = len(reqs)
        avg_readiness = round(total_pct / total_reqs, 1) if total_reqs > 0 else 100.0
        exp_status = "READY" if (avg_readiness >= 90.0 and critical_shortages == 0) else "NEEDS ATTENTION"

        results.append(
            schemas.ExpeditionReadinessOut(
                expedition_id=exp.id,
                expedition_name=exp.name,
                location=exp.location,
                status=exp_status,
                readiness_percentage=avg_readiness,
                total_requirements=total_reqs,
                fulfilled_requirements=fulfilled_count,
                critical_shortages_count=critical_shortages,
                requirements=req_details
            )
        )

    return results


# --- PERSONNEL MOVEMENT CRUD ---
def create_personnel_movement(
    db: Session,
    personnel_id: int,
    previous_location: str,
    new_location: str,
    previous_latitude: float,
    previous_longitude: float,
    new_latitude: float,
    new_longitude: float,
    status: str,
    movement_type: str,
    notes: str = None,
    timestamp: str = None
):
    if not timestamp:
        timestamp = get_current_timestamp()
    movement = models.PersonnelMovement(
        personnel_id=personnel_id,
        previous_location=previous_location,
        new_location=new_location,
        previous_latitude=previous_latitude,
        previous_longitude=previous_longitude,
        new_latitude=new_latitude,
        new_longitude=new_longitude,
        status=status,
        movement_type=movement_type,
        notes=notes,
        timestamp=timestamp
    )
    db.add(movement)
    return movement

def get_personnel_movements(db: Session, personnel_id: int, limit: int = 50):
    return db.query(models.PersonnelMovement).filter(
        models.PersonnelMovement.personnel_id == personnel_id
    ).order_by(models.PersonnelMovement.id.desc()).limit(limit).all()

def get_recent_personnel_movements(db: Session, limit: int = 10):
    return db.query(models.PersonnelMovement).order_by(
        models.PersonnelMovement.id.desc()
    ).limit(limit).all()

def trigger_personnel_emergency_alert(db: Session, person: models.Personnel, reason: str = None):
    timestamp = get_current_timestamp()
    title = f"EMERGENCY LOCATOR ACTIVE — {person.name} ({person.personnel_code})"
    msg = f"Personnel {person.name} [{person.personnel_code}] at {person.current_location} (Coordinates: {person.latitude:.4f}, {person.longitude:.4f}) has entered EMERGENCY status."
    if reason:
        msg += f" Note: {reason}"

    alert = models.Alert(
        type="Distress",
        title=title,
        message=msg,
        severity="CRITICAL",
        timestamp=timestamp,
        status="ACTIVE",
        source=f"Personnel Locator [{person.personnel_code}]",
        action_required="Initiate Search and Rescue (SAR) standby protocol and establish direct communication.",
        coordinates=f"{person.latitude:.4f}, {person.longitude:.4f}"
    )
    db.add(alert)
    return alert


# --- PERSONNEL CRUD ---
def get_personnel_list(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    status: str = None,
    role: str = None,
    expedition_id: int = None,
    search: str = None
):
    query = db.query(models.Personnel)

    if status and status.upper() != "ALL":
        query = query.filter(models.Personnel.status.ilike(f"%{status}%"))
    if role and role.upper() != "ALL":
        query = query.filter(models.Personnel.role.ilike(f"%{role}%"))
    if expedition_id:
        query = query.filter(models.Personnel.expedition_id == expedition_id)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                models.Personnel.personnel_code.ilike(s),
                models.Personnel.name.ilike(s),
                models.Personnel.role.ilike(s),
                models.Personnel.department.ilike(s),
                models.Personnel.current_location.ilike(s)
            )
        )

    return query.order_by(models.Personnel.id.asc()).offset(skip).limit(limit).all()

def get_personnel(db: Session, personnel_id: int):
    return db.query(models.Personnel).filter(models.Personnel.id == personnel_id).first()

def get_personnel_by_code(db: Session, personnel_code: str):
    return db.query(models.Personnel).filter(models.Personnel.personnel_code == personnel_code).first()

def get_personnel_detail(db: Session, personnel_id: int):
    person = get_personnel(db, personnel_id)
    if not person:
        return None
    exp_name = person.expedition.name if person.expedition else "Unassigned / General Station Crew"
    movements = get_personnel_movements(db, personnel_id)

    return schemas.PersonnelDetailOut(
        id=person.id,
        personnel_code=person.personnel_code,
        name=person.name,
        role=person.role,
        department=person.department or "Science & Research",
        contact=person.contact,
        status=person.status,
        current_location=person.current_location,
        latitude=person.latitude,
        longitude=person.longitude,
        specialization=person.specialization,
        heart_rate=person.heart_rate,
        spo2=person.spo2,
        body_temp=person.body_temp,
        battery=person.battery,
        emergency_contact=person.emergency_contact,
        expedition_id=person.expedition_id,
        expedition_name=exp_name,
        last_updated=person.last_updated,
        created_at=person.created_at,
        movements=[schemas.PersonnelMovementOut.model_validate(m) for m in movements]
    )

def create_personnel(db: Session, person: schemas.PersonnelCreate):
    timestamp = get_current_timestamp()
    person_data = person.model_dump()
    person_data["created_at"] = timestamp
    person_data["last_updated"] = timestamp

    db_person = models.Personnel(**person_data)
    db.add(db_person)
    db.commit()
    db.refresh(db_person)

    # Automatically create initial movement history entry
    create_personnel_movement(
        db=db,
        personnel_id=db_person.id,
        previous_location=None,
        new_location=db_person.current_location,
        previous_latitude=None,
        previous_longitude=None,
        new_latitude=db_person.latitude,
        new_longitude=db_person.longitude,
        status=db_person.status,
        movement_type="MANUAL_UPDATE",
        notes=f"Initial registration of {db_person.name} on expedition roster.",
        timestamp=timestamp
    )

    # If registered with emergency status, trigger alert and create emergency incident
    if db_person.status.upper() == "EMERGENCY":
        trigger_personnel_emergency_alert(db, db_person, reason="Initial crew registration in EMERGENCY state")
        create_or_get_personnel_sos_incident(db, db_person.id, reason="Initial crew registration in EMERGENCY state", actor="System Registration")

    db.commit()
    db.refresh(db_person)
    return db_person

def update_personnel(db: Session, personnel_id: int, person_update: schemas.PersonnelUpdate):
    db_person = get_personnel(db, personnel_id)
    if not db_person:
        return None
    
    prev_status = db_person.status
    update_data = person_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_person, key, value)
    
    db_person.last_updated = get_current_timestamp()

    # Trigger emergency alert and incident if transitioned to EMERGENCY
    if prev_status.upper() != "EMERGENCY" and db_person.status.upper() == "EMERGENCY":
        trigger_personnel_emergency_alert(db, db_person, reason="Personnel status changed to EMERGENCY")
        create_or_get_personnel_sos_incident(db, db_person.id, reason="Personnel status changed to EMERGENCY", actor="Logistics Director")

    db.commit()
    db.refresh(db_person)
    return db_person

def update_personnel_location(
    db: Session,
    personnel_id: int,
    location_update: schemas.PersonnelLocationUpdate
):
    """
    Atomic personnel location update.
    Saves previous location and numeric coordinates, updates state,
    appends immutable movement history, checks emergency transition, and commits.
    """
    person = get_personnel(db, personnel_id)
    if not person:
        return None, "Personnel not found"

    prev_loc = person.current_location
    prev_lat = person.latitude
    prev_lon = person.longitude
    prev_status = person.status
    timestamp = get_current_timestamp()

    new_status = location_update.status or person.status

    person.current_location = location_update.location_name
    person.latitude = location_update.latitude
    person.longitude = location_update.longitude
    person.status = new_status
    person.last_updated = timestamp

    # Create movement history
    create_personnel_movement(
        db=db,
        personnel_id=person.id,
        previous_location=prev_loc,
        new_location=person.current_location,
        previous_latitude=prev_lat,
        previous_longitude=prev_lon,
        new_latitude=person.latitude,
        new_longitude=person.longitude,
        status=person.status,
        movement_type=location_update.movement_type or "MANUAL_UPDATE",
        notes=location_update.notes or f"Location updated from {prev_loc} to {person.current_location}",
        timestamp=timestamp
    )

    # Check emergency status transition
    if prev_status.upper() != "EMERGENCY" and person.status.upper() == "EMERGENCY":
        reason_msg = location_update.notes or f"Status changed to EMERGENCY during movement to {person.current_location}"
        trigger_personnel_emergency_alert(db=db, person=person, reason=reason_msg)
        create_or_get_personnel_sos_incident(db=db, personnel_id=person.id, reason=reason_msg, actor="Field Telemetry Tracker")

    db.commit()
    db.refresh(person)
    return person, None


def get_personnel_summary_stats(db: Session):
    total = db.query(models.Personnel).count()
    at_station = db.query(models.Personnel).filter(
        or_(models.Personnel.status == "AT_STATION", models.Personnel.status == "At Station")
    ).count()
    field = db.query(models.Personnel).filter(
        or_(models.Personnel.status == "FIELD", models.Personnel.status == "Field")
    ).count()
    in_transit = db.query(models.Personnel).filter(
        or_(models.Personnel.status == "IN_TRANSIT", models.Personnel.status == "Transit", models.Personnel.status == "In Transit")
    ).count()
    emergency = db.query(models.Personnel).filter(
        or_(models.Personnel.status == "EMERGENCY", models.Personnel.status == "Emergency")
    ).count()
    resting = db.query(models.Personnel).filter(
        or_(models.Personnel.status == "RESTING", models.Personnel.status == "Resting")
    ).count()
    off_duty = db.query(models.Personnel).filter(
        or_(models.Personnel.status == "OFF_DUTY", models.Personnel.status == "Off Duty")
    ).count()

    return schemas.PersonnelSummaryStatsOut(
        total_personnel=total,
        at_station=at_station,
        field=field,
        in_transit=in_transit,
        emergency=emergency,
        resting=resting,
        off_duty=off_duty
    )

def get_personnel_locations(db: Session):
    personnel = db.query(models.Personnel).all()
    return [
        schemas.PersonnelLocationMapOut(
            id=p.id,
            personnel_code=p.personnel_code,
            name=p.name,
            role=p.role,
            department=p.department or "Science & Research",
            status=p.status,
            current_location=p.current_location,
            latitude=p.latitude,
            longitude=p.longitude,
            last_updated=p.last_updated or "Recent"
        )
        for p in personnel
    ]


# --- ALERTS CRUD ---
def get_alerts_list(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Alert).order_by(models.Alert.id.desc()).offset(skip).limit(limit).all()

def get_alert(db: Session, alert_id: int):
    return db.query(models.Alert).filter(models.Alert.id == alert_id).first()

def create_alert(db: Session, alert: schemas.AlertCreate):
    db_alert = models.Alert(**alert.model_dump())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert

def update_alert(db: Session, alert_id: int, alert_update: schemas.AlertUpdate):
    db_alert = get_alert(db, alert_id)
    if not db_alert:
        return None
    update_data = alert_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_alert, key, value)
    db.commit()
    db.refresh(db_alert)
    return db_alert


# --- RESPONSE UNITS CRUD ---
def get_response_units(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    unit_type: str = None,
    team: str = None,
    search: str = None
):
    query = db.query(models.ResponseUnit)
    if status and status.upper() != "ALL":
        query = query.filter(models.ResponseUnit.status.ilike(f"%{status}%"))
    if unit_type and unit_type.upper() != "ALL":
        query = query.filter(models.ResponseUnit.unit_type.ilike(f"%{unit_type}%"))
    if team and team.upper() != "ALL":
        query = query.filter(models.ResponseUnit.team.ilike(f"%{team}%"))
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                models.ResponseUnit.unit_code.ilike(s),
                models.ResponseUnit.name.ilike(s),
                models.ResponseUnit.capabilities.ilike(s),
                models.ResponseUnit.current_location.ilike(s)
            )
        )
    units = query.order_by(models.ResponseUnit.id.asc()).offset(skip).limit(limit).all()
    out = []
    for u in units:
        uo = schemas.ResponseUnitOut.model_validate(u)
        active_inc = db.query(models.Incident).filter(
            models.Incident.assigned_unit_id == u.id,
            models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
        ).first()
        if active_inc:
            uo.active_incident_code = active_inc.incident_code
        out.append(uo)
    return out

def get_response_unit(db: Session, unit_id: int):
    u = db.query(models.ResponseUnit).filter(models.ResponseUnit.id == unit_id).first()
    if not u:
        return None
    uo = schemas.ResponseUnitOut.model_validate(u)
    active_inc = db.query(models.Incident).filter(
        models.Incident.assigned_unit_id == u.id,
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).first()
    if active_inc:
        uo.active_incident_code = active_inc.incident_code
    return uo

def get_response_unit_by_code(db: Session, unit_code: str):
    return db.query(models.ResponseUnit).filter(models.ResponseUnit.unit_code == unit_code).first()

def create_response_unit(db: Session, unit: schemas.ResponseUnitCreate):
    timestamp = get_current_timestamp()
    u_data = unit.model_dump()
    u_data["created_at"] = timestamp
    u_data["updated_at"] = timestamp
    db_u = models.ResponseUnit(**u_data)
    db.add(db_u)
    db.commit()
    db.refresh(db_u)
    return db_u

def update_response_unit(db: Session, unit_id: int, unit_update: schemas.ResponseUnitUpdate):
    db_u = db.query(models.ResponseUnit).filter(models.ResponseUnit.id == unit_id).first()
    if not db_u:
        return None
    update_data = unit_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_u, key, value)
    db_u.updated_at = get_current_timestamp()
    db.commit()
    db.refresh(db_u)
    return db_u

def get_response_unit_locations(db: Session):
    units = db.query(models.ResponseUnit).all()
    results = []
    for u in units:
        active_inc = db.query(models.Incident).filter(
            models.Incident.assigned_unit_id == u.id,
            models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
        ).first()
        results.append(
            schemas.ResponseUnitLocationMapOut(
                id=u.id,
                unit_code=u.unit_code,
                name=u.name,
                unit_type=u.unit_type,
                team=u.team,
                status=u.status,
                current_location=u.current_location,
                latitude=u.latitude,
                longitude=u.longitude,
                capabilities=u.capabilities,
                active_incident_code=active_inc.incident_code if active_inc else None
            )
        )
    return results


# --- INCIDENT EVENT / AUDIT LOGGING ---
def create_incident_event(
    db: Session,
    incident_id: int,
    event_type: str,
    previous_status: str = None,
    new_status: str = None,
    notes: str = None,
    actor: str = "Logistics Director",
    timestamp: str = None
):
    if not timestamp:
        timestamp = get_current_timestamp()
    event = models.IncidentEvent(
        incident_id=incident_id,
        event_type=event_type,
        previous_status=previous_status,
        new_status=new_status,
        notes=notes,
        actor=actor or "Logistics Director",
        timestamp=timestamp
    )
    db.add(event)
    return event

def get_incident_events(db: Session, incident_id: int):
    return db.query(models.IncidentEvent).filter(
        models.IncidentEvent.incident_id == incident_id
    ).order_by(models.IncidentEvent.id.desc()).all()


# --- INCIDENT CRUD & STATE MACHINE ---
def generate_incident_code(db: Session) -> str:
    count = db.query(models.Incident).count() + 1
    code = f"INC-2026-{count:03d}"
    while db.query(models.Incident).filter(models.Incident.incident_code == code).first():
        count += 1
        code = f"INC-2026-{count:03d}"
    return code

def enrich_incident_out(db: Session, inc: models.Incident) -> schemas.IncidentOut:
    inc_dict = schemas.IncidentOut.model_validate(inc)
    if inc.personnel:
        inc_dict.personnel_name = inc.personnel.name
        inc_dict.personnel_code = inc.personnel.personnel_code
    if inc.assigned_unit:
        inc_dict.assigned_unit_code = inc.assigned_unit.unit_code
        inc_dict.assigned_unit_name = inc.assigned_unit.name
        inc_dict.assigned_unit_type = inc.assigned_unit.unit_type
    return inc_dict

def get_incidents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    severity: str = None,
    incident_type: str = None,
    is_active: bool = None,
    assigned: bool = None,
    search: str = None
):
    query = db.query(models.Incident)

    if status and status.upper() != "ALL":
        query = query.filter(models.Incident.status.ilike(f"%{status}%"))
    if severity and severity.upper() != "ALL":
        query = query.filter(models.Incident.severity.ilike(f"%{severity}%"))
    if incident_type and incident_type.upper() != "ALL":
        query = query.filter(models.Incident.incident_type.ilike(f"%{incident_type}%"))
    if is_active is not None:
        if is_active:
            query = query.filter(models.Incident.status.notin_(["RESOLVED", "CANCELLED"]))
        else:
            query = query.filter(models.Incident.status.in_(["RESOLVED", "CANCELLED"]))
    if assigned is not None:
        if assigned:
            query = query.filter(models.Incident.assigned_unit_id.isnot(None))
        else:
            query = query.filter(models.Incident.assigned_unit_id.is_(None))
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                models.Incident.incident_code.ilike(s),
                models.Incident.title.ilike(s),
                models.Incident.description.ilike(s),
                models.Incident.location_name.ilike(s),
                models.Incident.reported_by.ilike(s)
            )
        )

    incidents = query.order_by(models.Incident.id.desc()).offset(skip).limit(limit).all()
    return [enrich_incident_out(db, inc) for inc in incidents]

def get_active_incidents(db: Session):
    incidents = db.query(models.Incident).filter(
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).order_by(models.Incident.id.desc()).all()
    return [enrich_incident_out(db, inc) for inc in incidents]

def get_incident(db: Session, incident_id: int):
    return db.query(models.Incident).filter(models.Incident.id == incident_id).first()

def get_incident_by_code(db: Session, incident_code: str):
    return db.query(models.Incident).filter(models.Incident.incident_code == incident_code).first()

def get_incident_detail(db: Session, incident_id: int):
    inc = get_incident(db, incident_id)
    if not inc:
        return None

    events = get_incident_events(db, incident_id)
    recommended = recommend_response_units(db, incident_id)

    pers_data = None
    if inc.personnel:
        pers_data = schemas.PersonnelOut.model_validate(inc.personnel)

    unit_data = None
    if inc.assigned_unit:
        unit_data = schemas.ResponseUnitOut.model_validate(inc.assigned_unit)

    base_out = enrich_incident_out(db, inc)
    
    return schemas.IncidentDetailOut(
        **base_out.model_dump(),
        personnel_data=pers_data,
        assigned_unit_data=unit_data,
        events=[schemas.IncidentEventOut.model_validate(e) for e in events],
        recommended_units=recommended
    )

def sync_incident_alerts(db: Session, inc: models.Incident, new_status: str, action_text: str = None):
    """Synchronize matching alerts with an incident's updated lifecycle state."""
    filters = [
        models.Alert.source.contains(inc.incident_code),
        models.Alert.title.contains(inc.incident_code),
        models.Alert.title.contains(inc.title)
    ]
    if inc.personnel_id:
        person = inc.personnel or db.query(models.Personnel).filter(models.Personnel.id == inc.personnel_id).first()
        if person and person.personnel_code:
            filters.append(models.Alert.source.contains(person.personnel_code))
            filters.append(models.Alert.title.contains(person.personnel_code))

    matching_alerts = db.query(models.Alert).filter(or_(*filters)).all()
    for al in matching_alerts:
        al.status = new_status
        if action_text:
            al.action_required = action_text
    return matching_alerts

def create_incident(db: Session, inc_in: schemas.IncidentCreate, actor: str = "Logistics Officer"):
    timestamp = get_current_timestamp()
    inc_code = inc_in.incident_code or generate_incident_code(db)
    
    data = inc_in.model_dump()
    data["incident_code"] = inc_code
    data["created_at"] = timestamp

    # If personnel attached, populate default location if missing
    if data.get("personnel_id"):
        person = get_personnel(db, data["personnel_id"])
        if person:
            if data.get("latitude") is None:
                data["latitude"] = person.latitude
            if data.get("longitude") is None:
                data["longitude"] = person.longitude
            if not data.get("location_name") or data["location_name"] == "Unknown Polar Sector":
                data["location_name"] = person.current_location

    db_inc = models.Incident(**data)
    db.add(db_inc)
    db.flush()

    # Log initial creation audit event
    create_incident_event(
        db=db,
        incident_id=db_inc.id,
        event_type="INCIDENT_CREATED",
        previous_status=None,
        new_status=db_inc.status,
        notes=f"Emergency incident {db_inc.incident_code} registered. Severity: {db_inc.severity}. Type: {db_inc.incident_type}.",
        actor=actor or db_inc.reported_by,
        timestamp=timestamp
    )

    # If created with assigned unit, update unit state
    if db_inc.assigned_unit_id:
        unit = db.query(models.ResponseUnit).filter(models.ResponseUnit.id == db_inc.assigned_unit_id).first()
        if unit:
            unit.status = "DISPATCHED" if db_inc.status == "DISPATCHED" else "ON_MISSION" if db_inc.status == "IN_PROGRESS" else unit.status
            unit.updated_at = timestamp

    # Synchronize with Emergency Alerts / Live Telemetry Feeds
    alert_type = "Distress" if db_inc.incident_type in ["MEDICAL", "MISSING_PERSON"] else "Operational" if db_inc.incident_type in ["CARGO", "VEHICLE"] else "System"
    coords_str = f"{db_inc.latitude}, {db_inc.longitude}" if db_inc.latitude is not None and db_inc.longitude is not None else (db_inc.location_name or "Maitri Sector")
    alert_action = f"Immediate SAR triage and response protocol initiated for {db_inc.location_name}." if db_inc.severity == "CRITICAL" else f"Triage and dispatch response unit to {db_inc.location_name}."
    
    alert = models.Alert(
        type=alert_type,
        title=f"Incident {db_inc.incident_code} — {db_inc.title}",
        message=db_inc.description or f"Emergency incident reported at {db_inc.location_name}.",
        severity=db_inc.severity or "HIGH",
        timestamp=f"Just now ({timestamp[11:16]} UTC)" if len(timestamp) >= 16 else timestamp,
        status="ACTIVE" if db_inc.status not in ["DISPATCHED", "RESOLVED", "CANCELLED"] else db_inc.status,
        source=f"Incident [{db_inc.incident_code}]",
        action_required=alert_action,
        coordinates=coords_str
    )
    db.add(alert)

    db.commit()
    db.refresh(db_inc)
    return enrich_incident_out(db, db_inc)

def acknowledge_incident(db: Session, incident_id: int, actor: str = "Logistics Director", notes: str = None):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Cannot acknowledge incident in terminal state '{inc.status}'"

    prev_status = inc.status
    timestamp = get_current_timestamp()

    inc.status = "ACKNOWLEDGED"
    inc.acknowledged_at = timestamp

    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="INCIDENT_ACKNOWLEDGED",
        previous_status=prev_status,
        new_status="ACKNOWLEDGED",
        notes=notes or f"Incident acknowledged by {actor}. SAR standby activated.",
        actor=actor,
        timestamp=timestamp
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def triage_incident(db: Session, incident_id: int, triage_update: schemas.IncidentTriageUpdate):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Cannot triage incident in terminal state '{inc.status}'"

    valid_severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    sev = triage_update.severity.upper()
    if sev not in valid_severities:
        return None, f"Invalid severity '{triage_update.severity}'. Allowed: {', '.join(valid_severities)}"

    prev_status = inc.status
    prev_sev = inc.severity
    timestamp = get_current_timestamp()

    inc.severity = sev
    if inc.status in ["REPORTED", "ACKNOWLEDGED"]:
        inc.status = "TRIAGED"

    actor = triage_update.actor or "Operations Commander"
    notes_msg = triage_update.notes or f"Triage evaluation: severity updated from {prev_sev} to {sev}."

    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="TRIAGE_UPDATED",
        previous_status=prev_status,
        new_status=inc.status,
        notes=notes_msg,
        actor=actor,
        timestamp=timestamp
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def assign_incident_unit(db: Session, incident_id: int, assign_update: schemas.IncidentAssignUpdate):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Cannot assign unit to incident in terminal state '{inc.status}'"

    unit = db.query(models.ResponseUnit).filter(models.ResponseUnit.id == assign_update.response_unit_id).first()
    if not unit:
        return None, f"Response Unit with ID {assign_update.response_unit_id} not found"

    # Allow assignment if unit is AVAILABLE, or if already assigned to this incident
    if unit.status.upper() not in ["AVAILABLE", "RETURNING"] and inc.assigned_unit_id != unit.id:
        return None, f"Response Unit '{unit.unit_code} ({unit.name})' is currently {unit.status} and cannot be assigned."

    prev_unit_id = inc.assigned_unit_id
    if prev_unit_id and prev_unit_id != unit.id:
        prev_unit = db.query(models.ResponseUnit).filter(models.ResponseUnit.id == prev_unit_id).first()
        if prev_unit:
            prev_unit.status = "AVAILABLE"
            prev_unit.updated_at = get_current_timestamp()

    timestamp = get_current_timestamp()
    inc.assigned_unit_id = unit.id

    actor = assign_update.actor or "SAR Dispatch Controller"
    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="UNIT_ASSIGNED",
        previous_status=inc.status,
        new_status=inc.status,
        notes=assign_update.notes or f"Unit {unit.unit_code} ({unit.name} - {unit.unit_type}) assigned to incident.",
        actor=actor,
        timestamp=timestamp
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def dispatch_incident(db: Session, incident_id: int, action_update: schemas.IncidentActionUpdate):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Cannot dispatch incident in terminal state '{inc.status}'"

    if not inc.assigned_unit_id:
        return None, "Cannot dispatch incident without an assigned Response Unit. Please assign a unit first."

    unit = inc.assigned_unit
    if not unit:
        unit = db.query(models.ResponseUnit).filter(models.ResponseUnit.id == inc.assigned_unit_id).first()

    prev_status = inc.status
    timestamp = get_current_timestamp()

    inc.status = "DISPATCHED"
    inc.dispatched_at = timestamp

    if unit:
        unit.status = "DISPATCHED"
        unit.updated_at = timestamp

    actor = action_update.actor or "SAR Dispatch Controller"
    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="UNIT_DISPATCHED",
        previous_status=prev_status,
        new_status="DISPATCHED",
        notes=action_update.notes or f"Unit {unit.unit_code if unit else 'SAR'} dispatched to coordinates ({inc.latitude}, {inc.longitude}).",
        actor=actor,
        timestamp=timestamp
    )

    sync_incident_alerts(
        db=db,
        inc=inc,
        new_status="DISPATCHED",
        action_text=f"Unit {unit.unit_code if unit else 'SAR'} dispatched to coordinates ({inc.latitude}, {inc.longitude}). Intercept protocol active."
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def start_incident_mission(db: Session, incident_id: int, action_update: schemas.IncidentActionUpdate):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Cannot start response for incident in terminal state '{inc.status}'"

    prev_status = inc.status
    timestamp = get_current_timestamp()

    inc.status = "IN_PROGRESS"

    if inc.assigned_unit:
        inc.assigned_unit.status = "ON_MISSION"
        inc.assigned_unit.updated_at = timestamp

    actor = action_update.actor or "Field SAR Team Leader"
    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="INCIDENT_STARTED",
        previous_status=prev_status,
        new_status="IN_PROGRESS",
        notes=action_update.notes or "Search & Rescue operation actively in progress on site.",
        actor=actor,
        timestamp=timestamp
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def resolve_incident(db: Session, incident_id: int, resolve_update: schemas.IncidentResolveUpdate):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Incident already in terminal state '{inc.status}'"

    if not resolve_update.resolution_notes or not resolve_update.resolution_notes.strip():
        return None, "Resolution notes are required to resolve an emergency incident."

    prev_status = inc.status
    timestamp = get_current_timestamp()

    inc.status = "RESOLVED"
    inc.resolved_at = timestamp
    inc.resolution_notes = resolve_update.resolution_notes.strip()

    # Free assigned response unit
    if inc.assigned_unit:
        next_status = (resolve_update.unit_next_status or "AVAILABLE").upper()
        inc.assigned_unit.status = next_status if next_status in ["AVAILABLE", "RETURNING"] else "AVAILABLE"
        inc.assigned_unit.updated_at = timestamp

    # If linked to personnel, reset personnel status if needed
    if inc.personnel and inc.personnel.status.upper() == "EMERGENCY":
        inc.personnel.status = "RESTING"
        inc.personnel.last_updated = timestamp
        create_personnel_movement(
            db=db,
            personnel_id=inc.personnel.id,
            previous_location=inc.personnel.current_location,
            new_location=inc.personnel.current_location,
            previous_latitude=inc.personnel.latitude,
            previous_longitude=inc.personnel.longitude,
            new_latitude=inc.personnel.latitude,
            new_longitude=inc.personnel.longitude,
            status="RESTING",
            movement_type="RETURN_TO_BASE",
            notes=f"Emergency incident {inc.incident_code} resolved. Personnel status set to RESTING.",
            timestamp=timestamp
        )

    actor = resolve_update.actor or "Operations Commander"
    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="INCIDENT_RESOLVED",
        previous_status=prev_status,
        new_status="RESOLVED",
        notes=f"Incident resolved: {inc.resolution_notes}",
        actor=actor,
        timestamp=timestamp
    )

    sync_incident_alerts(
        db=db,
        inc=inc,
        new_status="RESOLVED",
        action_text=f"Incident resolved: {inc.resolution_notes}"
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def cancel_incident(db: Session, incident_id: int, action_update: schemas.IncidentActionUpdate):
    inc = get_incident(db, incident_id)
    if not inc:
        return None, "Incident not found"
    
    if inc.status in ["RESOLVED", "CANCELLED"]:
        return None, f"Incident already in terminal state '{inc.status}'"

    prev_status = inc.status
    timestamp = get_current_timestamp()

    inc.status = "CANCELLED"
    inc.resolution_notes = action_update.notes or "Cancelled by operator."

    if inc.assigned_unit:
        inc.assigned_unit.status = "AVAILABLE"
        inc.assigned_unit.updated_at = timestamp

    actor = action_update.actor or "Operations Commander"
    create_incident_event(
        db=db,
        incident_id=inc.id,
        event_type="INCIDENT_CANCELLED",
        previous_status=prev_status,
        new_status="CANCELLED",
        notes=inc.resolution_notes,
        actor=actor,
        timestamp=timestamp
    )

    sync_incident_alerts(
        db=db,
        inc=inc,
        new_status="CANCELLED",
        action_text=f"Incident cancelled: {inc.resolution_notes}"
    )

    db.commit()
    db.refresh(inc)
    return enrich_incident_out(db, inc), None

def get_incident_summary_stats(db: Session):
    total = db.query(models.Incident).count()
    active = db.query(models.Incident).filter(models.Incident.status.notin_(["RESOLVED", "CANCELLED"])).count()
    critical = db.query(models.Incident).filter(
        models.Incident.severity == "CRITICAL",
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).count()
    high = db.query(models.Incident).filter(
        models.Incident.severity == "HIGH",
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).count()
    medium_low = db.query(models.Incident).filter(
        models.Incident.severity.in_(["MEDIUM", "LOW"]),
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).count()

    reported = db.query(models.Incident).filter(models.Incident.status == "REPORTED").count()
    triaged = db.query(models.Incident).filter(models.Incident.status.in_(["ACKNOWLEDGED", "TRIAGED"])).count()
    dispatched = db.query(models.Incident).filter(models.Incident.status == "DISPATCHED").count()
    in_progress = db.query(models.Incident).filter(models.Incident.status == "IN_PROGRESS").count()
    resolved = db.query(models.Incident).filter(models.Incident.status == "RESOLVED").count()
    cancelled = db.query(models.Incident).filter(models.Incident.status == "CANCELLED").count()

    units_avail = db.query(models.ResponseUnit).filter(models.ResponseUnit.status == "AVAILABLE").count()
    units_total = db.query(models.ResponseUnit).count()

    return schemas.IncidentSummaryStatsOut(
        total_incidents=total,
        active_incidents=active,
        critical_count=critical,
        high_count=high,
        medium_low_count=medium_low,
        reported_count=reported,
        triaged_count=triaged,
        dispatched_count=dispatched,
        in_progress_count=in_progress,
        resolved_count=resolved,
        cancelled_count=cancelled,
        units_available=units_avail,
        units_total=units_total
    )

def get_incident_locations(db: Session):
    incidents = db.query(models.Incident).filter(
        models.Incident.status.notin_(["CANCELLED"])
    ).all()
    results = []
    for inc in incidents:
        if inc.latitude is not None and inc.longitude is not None:
            results.append(
                schemas.IncidentLocationMapOut(
                    id=inc.id,
                    incident_code=inc.incident_code,
                    title=inc.title,
                    incident_type=inc.incident_type,
                    severity=inc.severity,
                    status=inc.status,
                    location_name=inc.location_name,
                    latitude=inc.latitude,
                    longitude=inc.longitude,
                    personnel_name=inc.personnel.name if inc.personnel else None,
                    assigned_unit_code=inc.assigned_unit.unit_code if inc.assigned_unit else None,
                    assigned_unit_latitude=inc.assigned_unit.latitude if inc.assigned_unit else None,
                    assigned_unit_longitude=inc.assigned_unit.longitude if inc.assigned_unit else None,
                    created_at=inc.created_at
                )
            )
    return results

def recommend_response_units(db: Session, incident_id: int):
    incident = get_incident(db, incident_id)
    if not incident:
        return []

    inc_lat = incident.latitude
    inc_lon = incident.longitude
    inc_type = (incident.incident_type or "").upper()

    units = db.query(models.ResponseUnit).all()
    recommendations = []

    for u in units:
        dist = calculate_haversine_distance(inc_lat, inc_lon, u.latitude, u.longitude)
        is_avail = (u.status.upper() == "AVAILABLE") or (u.id == incident.assigned_unit_id)
        caps = (u.capabilities or "").lower() + " " + (u.unit_type or "").lower()

        cap_match = False
        if inc_type == "MEDICAL" and any(k in caps for k in ["medical", "trauma", "doctor", "medic", "hypothermia", "evac"]):
            cap_match = True
        elif inc_type == "MISSING_PERSON" and any(k in caps for k in ["rescue", "search", "tracking", "field", "helicopter", "snowcat"]):
            cap_match = True
        elif inc_type in ["VEHICLE", "CARGO"] and any(k in caps for k in ["vehicle", "snowcat", "recovery", "mechanic", "tow", "heavy"]):
            cap_match = True
        elif inc_type == "FIRE" and any(k in caps for k in ["fire", "support", "hazard"]):
            cap_match = True
        elif inc_type in ["COMMUNICATION_LOSS", "WEATHER_ENVIRONMENTAL"] and any(k in caps for k in ["rescue", "field", "helicopter", "comms"]):
            cap_match = True
        elif inc_type == "OTHER":
            cap_match = True

        score = dist
        if not is_avail:
            score += 10000.0
        if not cap_match:
            score += 500.0

        reason_parts = []
        if is_avail:
            reason_parts.append("Unit is AVAILABLE")
        else:
            reason_parts.append(f"Unit currently {u.status}")
        
        if cap_match:
            reason_parts.append(f"Capabilities match {incident.incident_type} response")
        else:
            reason_parts.append("General response capability")

        if dist < 99990:
            reason_parts.append(f"{dist:.1f} km from incident location")

        u_out = schemas.ResponseUnitOut.model_validate(u)
        active_inc = db.query(models.Incident).filter(
            models.Incident.assigned_unit_id == u.id,
            models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
        ).first()
        if active_inc:
            u_out.active_incident_code = active_inc.incident_code

        recommendations.append(
            schemas.ResponseUnitRecommendationOut(
                unit=u_out,
                distance_km=dist,
                capability_match=cap_match,
                is_available=is_avail,
                score=round(score, 2),
                reason=" • ".join(reason_parts)
            )
        )

    recommendations.sort(key=lambda r: r.score)
    return recommendations

def create_or_get_personnel_sos_incident(
    db: Session,
    personnel_id: int,
    reason: str = None,
    actor: str = "Emergency Telemetry Monitor"
):
    person = get_personnel(db, personnel_id)
    if not person:
        return None, "Personnel not found"

    # Check for existing active emergency incident (status not in RESOLVED, CANCELLED)
    active_incident = db.query(models.Incident).filter(
        models.Incident.personnel_id == person.id,
        models.Incident.status.notin_(["RESOLVED", "CANCELLED"])
    ).first()

    timestamp = get_current_timestamp()

    if active_incident:
        # Existing active incident found — prevent duplicate
        return enrich_incident_out(db, active_incident), None

    # Mark personnel as EMERGENCY
    person.status = "EMERGENCY"
    person.last_updated = timestamp

    # Create new emergency incident
    inc_code = generate_incident_code(db)
    incident = models.Incident(
        incident_code=inc_code,
        title=f"Distress Beacon — {person.name} ({person.personnel_code})",
        incident_type="MEDICAL",
        severity="CRITICAL",
        status="REPORTED",
        personnel_id=person.id,
        reported_by=actor or "Emergency SOS Trigger",
        latitude=person.latitude,
        longitude=person.longitude,
        location_name=person.current_location or "Unknown Field Coordinates",
        description=reason or f"Emergency SOS beacon triggered for {person.name} [{person.personnel_code}] at {person.current_location}.",
        created_at=timestamp
    )
    db.add(incident)
    db.flush()

    create_incident_event(
        db=db,
        incident_id=incident.id,
        event_type="INCIDENT_CREATED",
        previous_status=None,
        new_status="REPORTED",
        notes=f"SOS beacon triggered. SAR triage protocol initiated for {person.name}.",
        actor=actor,
        timestamp=timestamp
    )

    # Also synchronize emergency alert for Live Telemetry Feeds
    coords_str = f"{person.latitude}, {person.longitude}" if person.latitude is not None and person.longitude is not None else (person.current_location or "Maitri Sector")
    sos_alert = models.Alert(
        type="Distress",
        title=f"SOS Distress Beacon — {person.name} ({person.personnel_code})",
        message=reason or f"Emergency SOS beacon triggered for {person.name} [{person.personnel_code}] at {person.current_location}.",
        severity="CRITICAL",
        timestamp=f"Just now ({timestamp[11:16]} UTC)" if len(timestamp) >= 16 else timestamp,
        status="ACTIVE",
        source=f"Incident [{incident.incident_code}] • Personnel [{person.personnel_code}]",
        action_required=f"Immediate SAR dispatch required to {person.current_location}. GPS: ({coords_str}).",
        coordinates=coords_str
    )
    db.add(sos_alert)

    db.commit()
    db.refresh(incident)
    return enrich_incident_out(db, incident), None


# --- STATIONS CRUD ---

def get_stations_list(db: Session, type: str = None, region: str = None, include_inactive: bool = True):
    query = db.query(models.Station)
    if not include_inactive:
        query = query.filter(models.Station.status != "INACTIVE")
    if type and type.upper() != "ALL":
        query = query.filter(models.Station.type.ilike(f"%{type}%"))
    if region and region.upper() != "ALL":
        query = query.filter(models.Station.region.ilike(f"%{region}%"))
    return query.order_by(models.Station.id.asc()).all()

def get_station(db: Session, station_id: int):
    return db.query(models.Station).filter(models.Station.id == station_id).first()

def get_station_by_name(db: Session, name: str):
    return db.query(models.Station).filter(models.Station.name == name).first()

def create_station(db: Session, station: schemas.StationCreate):
    timestamp = get_current_timestamp()
    st_data = station.model_dump()
    st_data["created_at"] = timestamp
    db_st = models.Station(**st_data)
    db.add(db_st)
    db.commit()
    db.refresh(db_st)
    return db_st

def update_station(db: Session, station_id: int, station_update: schemas.StationUpdate):
    st = get_station(db, station_id)
    if not st:
        return None
    update_data = station_update.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(st, field, val)
    db.commit()
    db.refresh(st)
    return st

def deactivate_station(db: Session, station_id: int):
    st = get_station(db, station_id)
    if not st:
        return None
    st.status = "INACTIVE"
    db.commit()
    db.refresh(st)
    return st

def reactivate_station(db: Session, station_id: int):
    st = get_station(db, station_id)
    if not st:
        return None
    st.status = "OPERATIONAL"
    db.commit()
    db.refresh(st)
    return st


# --- STATION RESOURCE REQUIREMENTS (PASS 1) ---
def get_station_requirements(db: Session, station_id: int, active_only: bool = True):
    query = db.query(models.StationResourceRequirement).filter(
        models.StationResourceRequirement.station_id == station_id
    )
    if active_only:
        query = query.filter(models.StationResourceRequirement.is_active == True)
    return query.order_by(models.StationResourceRequirement.id.asc()).all()

def get_station_requirement_by_resource(db: Session, station_id: int, item_code: str, active_only: bool = True):
    query = db.query(models.StationResourceRequirement).filter(
        models.StationResourceRequirement.station_id == station_id,
        models.StationResourceRequirement.item_code == item_code
    )
    if active_only:
        query = query.filter(models.StationResourceRequirement.is_active == True)
    return query.first()

def create_station_requirement(db: Session, station_id: int, req: schemas.StationResourceRequirementCreate):
    if req.minimum_quantity < 0:
        raise ValueError("Minimum quantity must be non-negative (>= 0).")
    
    st = get_station(db, station_id)
    if not st:
        raise ValueError(f"Station with ID {station_id} does not exist.")
    
    inv = db.query(models.Inventory).filter(models.Inventory.item_code == req.item_code).first()
    if not inv:
        raise ValueError(f"Resource with item code '{req.item_code}' does not exist in inventory.")
    
    existing = get_station_requirement_by_resource(db, station_id, req.item_code, active_only=True)
    if existing:
        raise ValueError(f"Active requirement already exists for station '{st.name}' and resource '{req.item_code}'.")
    
    timestamp = get_current_timestamp()
    item_name = req.item_name or inv.item_name
    unit = req.unit or inv.unit or "Units"
    
    db_req = models.StationResourceRequirement(
        station_id=station_id,
        item_code=req.item_code,
        item_name=item_name,
        minimum_quantity=float(req.minimum_quantity),
        unit=unit,
        is_active=True,
        created_at=timestamp,
        updated_at=timestamp
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

def update_station_requirement(db: Session, req_id: int, req_update: schemas.StationResourceRequirementUpdate):
    req = db.query(models.StationResourceRequirement).filter(models.StationResourceRequirement.id == req_id).first()
    if not req:
        return None
    
    data = req_update.model_dump(exclude_unset=True)
    if "minimum_quantity" in data and data["minimum_quantity"] is not None:
        if data["minimum_quantity"] < 0:
            raise ValueError("Minimum quantity must be non-negative (>= 0).")
        req.minimum_quantity = float(data["minimum_quantity"])
    if "unit" in data and data["unit"] is not None:
        req.unit = data["unit"]
    if "item_name" in data and data["item_name"] is not None:
        req.item_name = data["item_name"]
    if "is_active" in data and data["is_active"] is not None:
        req.is_active = data["is_active"]
    
    req.updated_at = get_current_timestamp()
    db.commit()
    db.refresh(req)
    return req

def deactivate_station_requirement(db: Session, req_id: int):
    req = db.query(models.StationResourceRequirement).filter(models.StationResourceRequirement.id == req_id).first()
    if not req:
        return None
    req.is_active = False
    req.updated_at = get_current_timestamp()
    db.commit()
    db.refresh(req)
    return req


# --- DAILY CONSUMPTION REGISTRY (PASS 1 + PASS 3 stock coupling) ---
def create_daily_consumption(db: Session, station_id: int, data: schemas.DailyConsumptionRecordCreate, user_id: int = None, username: str = "Station Officer"):
    if data.consumed_quantity < 0:
        raise ValueError("Consumed quantity must be non-negative (>= 0).")
    if data.consumed_quantity == 0:
        raise ValueError("Consumed quantity must be greater than zero.")

    st = get_station(db, station_id)
    if not st:
        raise ValueError(f"Station with ID {station_id} does not exist.")

    inv = db.query(models.Inventory).filter(models.Inventory.item_code == data.item_code).first()
    if not inv:
        raise ValueError(f"Resource with item code '{data.item_code}' does not exist in inventory.")

    try:
        from datetime import datetime
        datetime.strptime(data.consumption_date, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date format '{data.consumption_date}'. Must be YYYY-MM-DD.")

    existing = db.query(models.DailyConsumptionRecord).filter(
        models.DailyConsumptionRecord.station_id == station_id,
        models.DailyConsumptionRecord.item_code == data.item_code,
        models.DailyConsumptionRecord.consumption_date == data.consumption_date
    ).first()
    if existing:
        raise ValueError(f"Consumption record already exists for station '{st.name}', resource '{data.item_code}', and date '{data.consumption_date}'.")

    # Pass 3: prevent stock going negative
    if inv.quantity < data.consumed_quantity:
        raise ValueError(
            f"Insufficient stock: Cannot record {data.consumed_quantity} {inv.unit} consumed — "
            f"current inventory has only {inv.quantity} {inv.unit} available."
        )

    timestamp = get_current_timestamp()
    item_name = data.item_name or inv.item_name
    unit = data.unit or inv.unit or "Units"

    # Create the consumption record
    db_rec = models.DailyConsumptionRecord(
        station_id=station_id,
        item_code=data.item_code,
        item_name=item_name,
        consumption_date=data.consumption_date,
        consumed_quantity=float(data.consumed_quantity),
        unit=unit,
        notes=data.notes,
        recorded_at=timestamp,
        recorded_by_user_id=user_id,
        recorded_by=username
    )
    db.add(db_rec)

    # Pass 3: Apply STOCK_OUT to inventory to keep stock current
    prev_qty = inv.quantity
    new_qty = round(max(0.0, prev_qty - float(data.consumed_quantity)), 3)
    ls_r = get_setting_value(db, "inventory_low_stock_ratio", 1.5)
    cr_r = get_setting_value(db, "inventory_critical_ratio", 1.0)
    new_status = compute_inventory_status(new_qty, inv.minimum_quantity, low_stock_ratio=ls_r, critical_ratio=cr_r)
    prev_status = inv.status

    inv.quantity = new_qty
    inv.status = new_status
    inv.updated_at = timestamp

    create_inventory_transaction(
        db=db,
        inventory_id=inv.id,
        transaction_type="STOCK_OUT",
        quantity=float(data.consumed_quantity),
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reason=f"Daily consumption recorded — {data.consumption_date}" + (f" — {data.notes}" if data.notes else ""),
        user=username,
        timestamp=timestamp
    )

    # Trigger alert if stock status worsened
    check_and_trigger_inventory_alert(
        db=db,
        item=inv,
        prev_status=prev_status,
        new_status=new_status,
        reason=f"Daily consumption recorded for {item_name}"
    )

    db.commit()
    db.refresh(db_rec)
    return db_rec


def get_station_consumption_history(db: Session, station_id: int, start_date: str = None, end_date: str = None, limit: int = 100):
    query = db.query(models.DailyConsumptionRecord).filter(
        models.DailyConsumptionRecord.station_id == station_id
    )
    if start_date:
        query = query.filter(models.DailyConsumptionRecord.consumption_date >= start_date)
    if end_date:
        query = query.filter(models.DailyConsumptionRecord.consumption_date <= end_date)
    return query.order_by(
        models.DailyConsumptionRecord.consumption_date.desc(),
        models.DailyConsumptionRecord.id.desc()
    ).limit(limit).all()


def get_station_resource_intelligence(db: Session, station_id: int = None):
    """
    For each active StationResourceRequirement (filtered by station_id if provided),
    compute deterministic burn rate, consumption trend, days-remaining, and risk
    from real DailyConsumptionRecord data.

    Burn rate: 7-day average from actual records. Requires >= 3 records.
    Trend: deterministic comparison of recent 7-day avg vs prior 7-day avg.
    Days remaining: (current_stock - min_required) / burn_rate.
    Risk: NORMAL / LOW / CRITICAL / URGENT from existing Settings thresholds.

    Returns list of dicts (one per requirement row).
    """
    from datetime import datetime, timedelta

    # Fetch settings thresholds
    crit_thresh = get_setting_value(db, "automation_inventory_risk_critical_threshold", 75)
    high_thresh = get_setting_value(db, "automation_inventory_risk_high_threshold", 50)
    inv_crit_ratio = get_setting_value(db, "inventory_critical_ratio", 1.0)
    inv_low_ratio = get_setting_value(db, "inventory_low_stock_ratio", 1.5)

    # Query station requirements
    query = db.query(models.StationResourceRequirement).filter(
        models.StationResourceRequirement.is_active == True
    )
    if station_id is not None:
        query = query.filter(models.StationResourceRequirement.station_id == station_id)

    requirements = query.order_by(
        models.StationResourceRequirement.station_id,
        models.StationResourceRequirement.item_code
    ).all()

    today = datetime.utcnow().date()
    results = []

    for req in requirements:
        station = get_station(db, req.station_id)
        station_name = station.name if station else f"Station #{req.station_id}"

        # Find matching inventory item by item_code
        inv = db.query(models.Inventory).filter(
            models.Inventory.item_code == req.item_code
        ).first()

        current_stock = inv.quantity if inv else None
        inv_unit = inv.unit if inv else req.unit

        # Fetch last 14 days of consumption records for burn-rate + trend
        cutoff_14 = (today - timedelta(days=14)).isoformat()
        records_14 = db.query(models.DailyConsumptionRecord).filter(
            models.DailyConsumptionRecord.station_id == req.station_id,
            models.DailyConsumptionRecord.item_code == req.item_code,
            models.DailyConsumptionRecord.consumption_date >= cutoff_14
        ).order_by(models.DailyConsumptionRecord.consumption_date.desc()).all()

        # Split into recent (last 7 days) and prior (previous 7 days)
        cutoff_7 = (today - timedelta(days=7)).isoformat()
        recent_records = [r for r in records_14 if r.consumption_date > cutoff_7]
        prior_records = [r for r in records_14 if r.consumption_date <= cutoff_7]

        total_records = len(records_14)

        # Burn rate calculation (7-day average)
        if total_records >= 3:
            if recent_records:
                recent_avg = sum(r.consumed_quantity for r in recent_records) / len(recent_records)
            else:
                recent_avg = sum(r.consumed_quantity for r in records_14[:7]) / min(7, len(records_14))

            burn_rate_value = round(recent_avg, 2)
            display_burn = int(burn_rate_value) if burn_rate_value == int(burn_rate_value) else burn_rate_value
            burn_rate_text = f"{display_burn} {inv_unit}/day"
            has_burn_rate = True
        else:
            burn_rate_value = None
            burn_rate_text = "Insufficient consumption history"
            has_burn_rate = False

        # Trend calculation
        if total_records >= 3 and recent_records and prior_records:
            recent_avg_for_trend = sum(r.consumed_quantity for r in recent_records) / len(recent_records)
            prior_avg_for_trend = sum(r.consumed_quantity for r in prior_records) / len(prior_records)
            if prior_avg_for_trend > 0:
                pct_change = (recent_avg_for_trend - prior_avg_for_trend) / prior_avg_for_trend * 100
                if pct_change > 10:
                    trend = "INCREASING"
                elif pct_change < -10:
                    trend = "DECREASING"
                else:
                    trend = "STABLE"
                trend_pct = round(pct_change, 1)
            else:
                trend = "STABLE"
                trend_pct = 0.0
        else:
            trend = "INSUFFICIENT DATA"
            trend_pct = None

        # Days remaining and days to minimum
        min_qty = req.minimum_quantity
        if current_stock is None:
            days_remaining = None
            days_to_minimum = None
            forecast_status = "Stock data unavailable"
        elif current_stock <= min_qty:
            days_remaining = 0
            days_to_minimum = 0
            forecast_status = "Already below minimum"
        elif has_burn_rate and burn_rate_value and burn_rate_value > 0:
            days_remaining = round(current_stock / burn_rate_value)
            days_to_minimum = round((current_stock - min_qty) / burn_rate_value)
            forecast_status = f"{days_to_minimum} days until reserve breach"
        elif has_burn_rate and burn_rate_value == 0:
            days_remaining = None
            days_to_minimum = None
            forecast_status = "No recent consumption"
        else:
            days_remaining = None
            days_to_minimum = None
            forecast_status = "Forecast unavailable"

        # Risk score & level
        risk_score = 10.0
        risk_factors = []

        if current_stock is not None and min_qty > 0:
            ratio = current_stock / min_qty
            if ratio <= 0:
                risk_score += 65.0
                risk_factors.append("Stock fully depleted")
            elif ratio < inv_crit_ratio:
                risk_score += 45.0
                risk_factors.append(f"Stock at {round(ratio * 100, 1)}% of minimum (Critical Reserve Breach)")
            elif ratio < inv_low_ratio:
                risk_score += 20.0
                risk_factors.append(f"Stock at {round(ratio * 100, 1)}% of minimum (Low Reserve)")

        if days_to_minimum is not None and days_to_minimum == 0:
            risk_score += 30.0
            risk_factors.append("Already below minimum reserve")
        elif days_to_minimum is not None and days_to_minimum < 14:
            risk_score += 20.0
            risk_factors.append(f"Reserve breach in {days_to_minimum} days")
        elif days_to_minimum is not None and days_to_minimum < 30:
            risk_score += 10.0
            risk_factors.append(f"Reserve breach in {days_to_minimum} days")

        if trend == "INCREASING" and has_burn_rate:
            risk_score += 10.0
            risk_factors.append("Consumption trend is increasing")

        if req.item_code.startswith("FUEL") or req.item_code.startswith("MED"):
            risk_score += 8.0
            risk_factors.append("Life-support category resource")

        final_risk = round(min(100.0, max(0.0, risk_score)), 1)

        # 4-tier risk classification: NORMAL / LOW / CRITICAL / URGENT
        if (current_stock is not None and current_stock <= min_qty) or (days_to_minimum is not None and days_to_minimum <= 7):
            risk_level = "URGENT"
        elif final_risk >= crit_thresh or (days_to_minimum is not None and days_to_minimum <= 14):
            risk_level = "CRITICAL"
        elif final_risk >= high_thresh or (days_to_minimum is not None and days_to_minimum <= 30):
            risk_level = "LOW"
        else:
            risk_level = "NORMAL"

        # Build explainability WHY_FLAGGED list
        why_flagged = []
        if current_stock is not None and current_stock <= min_qty:
            why_flagged.append("Current stock is at or below minimum reserve")
        elif current_stock is not None and min_qty > 0 and (current_stock / min_qty) < 1.5:
            why_flagged.append(f"Current stock buffer is low ({round(current_stock, 1)} / {round(min_qty, 1)} {inv_unit})")

        if has_burn_rate and burn_rate_value and burn_rate_value > 0:
            why_flagged.append(f"Recent burn rate is {display_burn} {inv_unit}/day")
        elif not has_burn_rate:
            why_flagged.append("Insufficient consumption history")

        if trend == "INCREASING":
            why_flagged.append("Consumption trend is increasing")
        elif trend == "DECREASING":
            why_flagged.append("Consumption trend is decreasing")
        elif trend == "STABLE":
            why_flagged.append("Consumption trend is stable")

        if days_to_minimum is not None:
            if days_to_minimum == 0:
                why_flagged.append("Reserve is already breached — immediate replenishment required")
            elif days_to_minimum <= 14:
                why_flagged.append(f"Projected reserve breach in {days_to_minimum} days")
            elif days_to_minimum <= 30:
                why_flagged.append(f"Projected reserve is below minimum within {days_to_minimum} days")

        if not why_flagged:
            why_flagged.append("Nominal operational telemetry — stock above minimum requirements")

        surplus_deficit = None
        if current_stock is not None:
            surplus_deficit = round(current_stock - min_qty, 2)

        # Pass 3: include donor recommendations for shortage items
        donor_recs = []
        if surplus_deficit is not None and surplus_deficit < 0:
            deficit = abs(surplus_deficit)
            donor_recs = get_donor_recommendations(db, req.station_id, req.item_code, deficit)

        results.append({
            "requirement_id": req.id,
            "station_id": req.station_id,
            "station_name": station_name,
            "item_code": req.item_code,
            "item_name": req.item_name or (inv.item_name if inv else req.item_code),
            "minimum_quantity": min_qty,
            "unit": inv_unit,
            "current_stock": current_stock,
            "surplus_deficit": surplus_deficit,
            "burn_rate_value": burn_rate_value,
            "burn_rate_text": burn_rate_text,
            "trend": trend,
            "trend_pct": trend_pct,
            "days_remaining": days_remaining,
            "days_to_minimum": days_to_minimum,
            "forecast_status": forecast_status,
            "risk_score": final_risk,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "why_flagged": why_flagged,
            "consumption_record_count": total_records,
            "has_sufficient_history": total_records >= 3,
            "donor_recommendations": donor_recs,
        })

    return results


# --- DONOR RECOMMENDATION ENGINE (PASS 3) ---
def get_donor_recommendations(db: Session, destination_station_id: int, item_code: str, deficit: float = None, limit: int = 5):
    """
    Find active stations that hold item_code and have transferable surplus above their own minimum.
    A station is only eligible if: (stock - minimum_required) > 0.
    Never recommend a quantity that would bring the donor below its minimum.
    Ranked by: distance ASC, then surplus DESC.
    Returns a list of DonorRecommendationOut dicts.
    """
    dest_station = get_station(db, destination_station_id)
    if not dest_station:
        return []

    # All ACTIVE stations with a resource requirement for this item_code (excluding destination)
    donor_reqs = db.query(models.StationResourceRequirement).filter(
        models.StationResourceRequirement.item_code == item_code,
        models.StationResourceRequirement.is_active == True,
        models.StationResourceRequirement.station_id != destination_station_id
    ).all()

    # Also check for stations that hold this inventory item without a formal requirement
    inv_item = db.query(models.Inventory).filter(models.Inventory.item_code == item_code).first()
    unit = inv_item.unit if inv_item else "Units"

    candidates = []

    for req in donor_reqs:
        donor_station = get_station(db, req.station_id)
        if not donor_station or donor_station.status == "INACTIVE":
            continue

        # Current stock from Inventory table
        current_stock = inv_item.quantity if inv_item else None
        # Note: inventory is shared. For multi-station we use the matching inventory row.
        # If a station-specific stock is not implemented, use the global inventory.
        # This is honest about the limitation.
        if current_stock is None:
            continue

        min_required = req.minimum_quantity
        transferable_surplus = round(current_stock - min_required, 3)

        if transferable_surplus <= 0:
            continue  # Donor cannot safely transfer anything

        distance_km = calculate_haversine_distance(
            dest_station.latitude, dest_station.longitude,
            donor_station.latitude, donor_station.longitude
        )

        # Recommended quantity: limited by deficit and donor surplus
        rec_qty = transferable_surplus
        if deficit is not None:
            rec_qty = min(transferable_surplus, deficit)
        rec_qty = round(rec_qty, 3)

        candidates.append({
            "donor_station_id": donor_station.id,
            "donor_station_name": donor_station.name,
            "distance_km": distance_km,
            "donor_current_stock": current_stock,
            "donor_minimum_required": min_required,
            "donor_transferable_surplus": transferable_surplus,
            "recommended_transfer_quantity": rec_qty,
            "unit": unit,
        })

    # Rank: primary = distance ASC, secondary = surplus DESC
    candidates.sort(key=lambda c: (c["distance_km"], -c["donor_transferable_surplus"]))

    results = []
    for i, c in enumerate(candidates[:limit]):
        c["rank"] = i + 1
        results.append(schemas.DonorRecommendationOut(**c))

    return results


# --- TRANSFER REQUEST LIFECYCLE CRUD (PASS 3) ---
def _transfer_out(db: Session, req: 'models.StationTransferRequest') -> 'schemas.StationTransferRequestOut':
    """Build the StationTransferRequestOut schema from an ORM object."""
    src = get_station(db, req.source_station_id)
    dst = get_station(db, req.destination_station_id)
    return schemas.StationTransferRequestOut(
        id=req.id,
        source_station_id=req.source_station_id,
        source_station_name=src.name if src else f"Station #{req.source_station_id}",
        destination_station_id=req.destination_station_id,
        destination_station_name=dst.name if dst else f"Station #{req.destination_station_id}",
        item_code=req.item_code,
        item_name=req.item_name,
        unit=req.unit,
        requested_quantity=req.requested_quantity,
        approved_quantity=req.approved_quantity,
        transferred_quantity=req.transferred_quantity,
        request_reason=req.request_reason,
        approver_notes=req.approver_notes,
        completion_notes=req.completion_notes,
        distance_km=req.distance_km,
        requester_user_id=req.requester_user_id,
        approver_user_id=req.approver_user_id,
        requester_name=req.requester_name,
        approver_name=req.approver_name,
        status=req.status,
        requested_at=req.requested_at,
        reviewed_at=req.reviewed_at,
        completed_at=req.completed_at,
    )


def create_transfer_request(
    db: Session,
    destination_station_id: int,
    data: schemas.StationTransferRequestCreate,
    user_id: int,
    username: str
):
    """
    Create a new REQUESTED transfer from source → destination.
    Validates: stations exist, item exists, positive quantity,
    and that source has at least the requested quantity above its minimum.
    """
    if data.requested_quantity <= 0:
        raise ValueError("Requested quantity must be greater than zero.")

    dest = get_station(db, destination_station_id)
    if not dest:
        raise ValueError(f"Destination station {destination_station_id} does not exist.")

    src = get_station(db, data.source_station_id)
    if not src:
        raise ValueError(f"Source station {data.source_station_id} does not exist.")

    if data.source_station_id == destination_station_id:
        raise ValueError("Source and destination stations must be different.")

    inv = db.query(models.Inventory).filter(models.Inventory.item_code == data.item_code).first()
    if not inv:
        raise ValueError(f"Item code '{data.item_code}' not found in inventory.")

    # Check donor eligibility
    src_req = get_station_requirement_by_resource(db, data.source_station_id, data.item_code)
    src_minimum = src_req.minimum_quantity if src_req else 0.0
    transferable = inv.quantity - src_minimum

    if transferable <= 0:
        raise ValueError(
            f"Source station '{src.name}' has no safely transferable surplus for '{data.item_code}'. "
            f"Current stock: {inv.quantity} {inv.unit}, minimum reserve: {src_minimum} {inv.unit}."
        )

    if data.requested_quantity > transferable:
        raise ValueError(
            f"Requested quantity {data.requested_quantity} {inv.unit} exceeds safely transferable surplus "
            f"{round(transferable, 3)} {inv.unit} for source station '{src.name}'."
        )

    distance_km = calculate_haversine_distance(
        src.latitude, src.longitude,
        dest.latitude, dest.longitude
    )

    timestamp = get_current_timestamp()
    db_tr = models.StationTransferRequest(
        source_station_id=data.source_station_id,
        destination_station_id=destination_station_id,
        item_code=data.item_code,
        item_name=data.item_name or inv.item_name,
        unit=inv.unit,
        requested_quantity=float(data.requested_quantity),
        request_reason=data.request_reason,
        distance_km=round(distance_km, 2),
        requester_user_id=user_id,
        requester_name=username,
        status="REQUESTED",
        requested_at=timestamp,
    )
    db.add(db_tr)
    db.commit()
    db.refresh(db_tr)
    return db_tr


def get_transfer_requests(
    db: Session,
    station_id: int = None,
    status: str = None,
    limit: int = 100
):
    """List transfer requests, optionally filtered by station (source or dest) and/or status."""
    query = db.query(models.StationTransferRequest)
    if station_id is not None:
        query = query.filter(
            (models.StationTransferRequest.source_station_id == station_id) |
            (models.StationTransferRequest.destination_station_id == station_id)
        )
    if status:
        query = query.filter(models.StationTransferRequest.status == status.upper())
    return query.order_by(models.StationTransferRequest.id.desc()).limit(limit).all()


def get_transfer_request(db: Session, transfer_id: int):
    return db.query(models.StationTransferRequest).filter(
        models.StationTransferRequest.id == transfer_id
    ).first()


def review_transfer_request(
    db: Session,
    transfer_id: int,
    action: str,  # APPROVED | REJECTED
    approved_quantity: float = None,
    approver_notes: str = None,
    approver_id: int = None,
    approver_name: str = "Expedition Director"
):
    """
    Approve or reject a REQUESTED transfer.
    APPROVAL: sets approved_quantity (must be > 0 and <= requested_quantity).
    REJECTION: records notes, closes the request.
    Does NOT modify inventory stock.
    """
    tr = get_transfer_request(db, transfer_id)
    if not tr:
        raise ValueError(f"Transfer request {transfer_id} not found.")
    if tr.status != "REQUESTED":
        raise ValueError(f"Transfer request is in status '{tr.status}' — only REQUESTED transfers can be reviewed.")

    action_upper = action.upper()
    if action_upper not in ["APPROVED", "REJECTED"]:
        raise ValueError("Action must be APPROVED or REJECTED.")

    timestamp = get_current_timestamp()
    tr.approver_user_id = approver_id
    tr.approver_name = approver_name
    tr.approver_notes = approver_notes
    tr.reviewed_at = timestamp

    if action_upper == "APPROVED":
        eff_qty = approved_quantity if approved_quantity and approved_quantity > 0 else tr.requested_quantity
        if eff_qty > tr.requested_quantity:
            raise ValueError("Approved quantity cannot exceed requested quantity.")
        if eff_qty <= 0:
            raise ValueError("Approved quantity must be greater than zero.")
        tr.approved_quantity = float(eff_qty)
        tr.status = "APPROVED"
    else:
        tr.status = "REJECTED"

    db.commit()
    db.refresh(tr)
    return tr


def complete_transfer_request(
    db: Session,
    transfer_id: int,
    completion_notes: str = None,
    completer_id: int = None,
    completer_name: str = "Expedition Director"
):
    """
    Mark an APPROVED transfer as COMPLETED.
    Atomically:
      1. Re-validate donor stock against minimum (stale-stock protection)
      2. Decrease source inventory by transferred_quantity
      3. Increase destination inventory by transferred_quantity (via STOCK_IN)
      4. Record InventoryTransactions on both sides
      5. Mark transfer COMPLETED
    Inventory has a single row per item_code. Source deducts; destination adds
    (same row, net effect is zero, because it is a single shared inventory).
    For stations with independent stock rows this would update per-station rows.
    Since POLAR-X uses a shared inventory, we record the transfer audit trail
    in the transfer record and both STOCK_OUT/STOCK_IN transactions.
    """
    tr = get_transfer_request(db, transfer_id)
    if not tr:
        raise ValueError(f"Transfer request {transfer_id} not found.")
    if tr.status == "COMPLETED":
        raise ValueError("Transfer request is already COMPLETED.")
    if tr.status != "APPROVED":
        raise ValueError(f"Only APPROVED transfers can be completed (current status: '{tr.status}').")

    qty = float(tr.approved_quantity)

    # Stale-stock protection: re-read current inventory
    inv = db.query(models.Inventory).filter(models.Inventory.item_code == tr.item_code).first()
    if not inv:
        raise ValueError(f"Inventory item '{tr.item_code}' no longer exists.")

    src_req = get_station_requirement_by_resource(db, tr.source_station_id, tr.item_code)
    src_minimum = src_req.minimum_quantity if src_req else 0.0
    if inv.quantity - qty < src_minimum:
        raise ValueError(
            f"Source station stock is now insufficient: current {inv.quantity} {inv.unit}, "
            f"minimum reserve {src_minimum} {inv.unit}, requested transfer {qty} {inv.unit}. "
            "Transfer cannot be completed safely — please re-approve with a lower quantity."
        )

    if inv.quantity < qty:
        raise ValueError(
            f"Insufficient inventory to complete transfer: available {inv.quantity} {inv.unit}, "
            f"required {qty} {inv.unit}."
        )

    timestamp = get_current_timestamp()
    ls_r = get_setting_value(db, "inventory_low_stock_ratio", 1.5)
    cr_r = get_setting_value(db, "inventory_critical_ratio", 1.0)

    # STOCK_OUT from source (shared inventory — records the deduction)
    prev_qty = inv.quantity
    new_qty = round(max(0.0, prev_qty - qty), 3)
    new_status = compute_inventory_status(new_qty, inv.minimum_quantity, low_stock_ratio=ls_r, critical_ratio=cr_r)
    prev_status = inv.status

    inv.quantity = new_qty
    inv.status = new_status
    inv.updated_at = timestamp

    src_station = get_station(db, tr.source_station_id)
    dst_station = get_station(db, tr.destination_station_id)
    src_name = src_station.name if src_station else f"Station #{tr.source_station_id}"
    dst_name = dst_station.name if dst_station else f"Station #{tr.destination_station_id}"

    create_inventory_transaction(
        db=db,
        inventory_id=inv.id,
        transaction_type="STOCK_OUT",
        quantity=qty,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reason=f"Cross-station transfer #{tr.id}: {src_name} → {dst_name} (Transfer ID: {tr.id})",
        user=completer_name,
        timestamp=timestamp
    )

    check_and_trigger_inventory_alert(
        db=db, item=inv, prev_status=prev_status,
        new_status=new_status, reason=f"Cross-station transfer #{tr.id} completed"
    )

    # STOCK_IN to destination (recorded as audit, same shared inventory row)
    prev_qty2 = inv.quantity  # after STOCK_OUT
    new_qty2 = round(prev_qty2 + qty, 3)
    new_status2 = compute_inventory_status(new_qty2, inv.minimum_quantity, low_stock_ratio=ls_r, critical_ratio=cr_r)

    inv.quantity = new_qty2
    inv.status = new_status2
    inv.updated_at = timestamp

    create_inventory_transaction(
        db=db,
        inventory_id=inv.id,
        transaction_type="STOCK_IN",
        quantity=qty,
        previous_quantity=prev_qty2,
        new_quantity=new_qty2,
        reason=f"Cross-station transfer #{tr.id} received at {dst_name} from {src_name}",
        user=completer_name,
        timestamp=timestamp
    )

    # Mark transfer complete
    tr.transferred_quantity = qty
    tr.completion_notes = completion_notes
    tr.status = "COMPLETED"
    tr.completed_at = timestamp
    # Update approver/completer info
    if completer_id:
        tr.approver_user_id = completer_id
        tr.approver_name = completer_name

    db.commit()
    db.refresh(tr)
    return tr


def cancel_transfer_request(
    db: Session,
    transfer_id: int,
    cancelled_by: str = "Requester"
):
    """Cancel a REQUESTED transfer. APPROVED transfers can also be cancelled by Director."""
    tr = get_transfer_request(db, transfer_id)
    if not tr:
        raise ValueError(f"Transfer request {transfer_id} not found.")
    if tr.status in ["COMPLETED", "CANCELLED"]:
        raise ValueError(f"Transfer request is already '{tr.status}' and cannot be cancelled.")
    tr.status = "CANCELLED"
    tr.approver_notes = (tr.approver_notes or "") + f" | Cancelled by {cancelled_by}"
    db.commit()
    db.refresh(tr)
    return tr


# --- DASHBOARD AGGREGATION ---
def get_dashboard_summary(db: Session):
    active_expeditions = db.query(models.Expedition).filter(models.Expedition.status == "Active").count()
    total_assets = db.query(models.Cargo).count() + db.query(models.Inventory).count()
    personnel_deployed = db.query(models.Personnel).count()
    
    cargo_in_transit_query = db.query(models.Cargo).filter(models.Cargo.status == "In Transit")
    cargo_in_transit_count = cargo_in_transit_query.count()
    delivered_cargo_count = db.query(models.Cargo).filter(models.Cargo.status == "Delivered").count()
    delayed_cargo_count = db.query(models.Cargo).filter(models.Cargo.status == "Delayed").count()
    high_priority_cargo_count = db.query(models.Cargo).filter(
        models.Cargo.priority.in_(["High", "Critical"])
    ).count()

    critical_alerts = db.query(models.Alert).filter(
        models.Alert.severity == "CRITICAL",
        models.Alert.status != "RESOLVED"
    ).count()

    inventory_warnings = db.query(models.Inventory).filter(
        models.Inventory.status.in_(["LOW_STOCK", "CRITICAL", "OUT_OF_STOCK", "LOW STOCK"])
    ).count()

    expeditions = db.query(models.Expedition).limit(5).all()
    recent_cargo = db.query(models.Cargo).limit(10).all()
    recent_movements = get_recent_cargo_movements(db, limit=10)
    personnel = db.query(models.Personnel).limit(10).all()
    inventory = db.query(models.Inventory).limit(15).all()
    alerts = db.query(models.Alert).order_by(models.Alert.id.desc()).limit(10).all()

    return schemas.DashboardDataOut(
        summary=schemas.DashboardSummaryOut(
            active_expeditions_count=active_expeditions,
            total_assets_count=1248 if total_assets < 100 else total_assets,
            personnel_deployed_count=personnel_deployed if personnel_deployed > 0 else 86,
            cargo_in_transit_count=cargo_in_transit_count,
            cargo_in_transit_weight="14.2 Tons",
            delivered_cargo_count=delivered_cargo_count,
            delayed_cargo_count=delayed_cargo_count,
            high_priority_cargo_count=high_priority_cargo_count,
            critical_alerts_count=critical_alerts,
            inventory_warnings_count=inventory_warnings,
            system_status="ONLINE"
        ),
        expeditions=[schemas.ExpeditionOut.model_validate(e) for e in expeditions],
        recent_cargo=[schemas.CargoOut.model_validate(c) for c in recent_cargo],
        recent_movements=[schemas.CargoMovementOut.model_validate(m) for m in recent_movements],
        personnel=[schemas.PersonnelOut.model_validate(p) for p in personnel],
        inventory=[schemas.InventoryOut.model_validate(i) for i in inventory],
        alerts=[schemas.AlertOut.model_validate(a) for a in alerts]
    )


# --- SEED INITIAL DATA ---
def seed_initial_data(db: Session):
    # Ensure users table has assigned_station_id column in existing SQLite DBs before querying User model
    try:
        from sqlalchemy import text
        res = db.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in res.fetchall()]
        if "assigned_station_id" not in columns:
            db.execute(text("ALTER TABLE users ADD COLUMN assigned_station_id INTEGER REFERENCES stations(id)"))
            db.commit()
    except Exception:
        db.rollback()

    # 1. Expeditions (At least 3)
    exp1 = db.query(models.Expedition).filter(models.Expedition.name.ilike("%Maitri%")).first()
    if not exp1:
        exp1 = models.Expedition(
            name="Maitri Expedition 2027",
            sub_title="43rd Indian Scientific Expedition to Antarctica (ISEA)",
            location="Antarctica (Queen Maud Land / Schirmacher Oasis)",
            base_station="Maitri Station",
            start_date="2026-11-15",
            end_date="2027-04-10",
            status="Active",
            phase="Phase 2: Scientific Deployment & Inland Traverse",
            leader="Dr. Rajesh Sharma (NCPOR Lead Glaciologist)",
            personnel_count=42,
            cargo_weight="8.5 Tons",
            readiness=94,
            vessel_support="MV Vasiliy Golovnin (Chartered Polar Vessel)"
        )
        db.add(exp1)
        db.commit()
        db.refresh(exp1)

    exp2 = db.query(models.Expedition).filter(models.Expedition.name.ilike("%Bharati%")).first()
    if not exp2:
        exp2 = models.Expedition(
            name="Bharati Larsemann Deep Mission",
            sub_title="15th Bharati Wintering & Oceanography Campaign",
            location="Antarctica (Larsemann Hills / Prydz Bay)",
            base_station="Bharati Station",
            start_date="2026-09-01",
            end_date="2027-02-28",
            status="Active",
            phase="Phase 3: Coastal Marine Sediment Sampling",
            leader="Dr. Priya Nair (Ocean Biogeochemistry)",
            personnel_count=28,
            cargo_weight="4.2 Tons",
            readiness=98,
            vessel_support="ORV Sagar Kanya Support Fleet"
        )
        db.add(exp2)
        db.commit()
        db.refresh(exp2)

    exp3 = db.query(models.Expedition).filter(models.Expedition.name.ilike("%Himadri%")).first()
    if not exp3:
        exp3 = models.Expedition(
            name="Himadri Arctic Winter Study",
            sub_title="Svalbard Aerosol & Cryospheric Monitoring",
            location="Arctic (Ny-Ålesund, Svalbard)",
            base_station="Himadri Station",
            start_date="2026-10-01",
            end_date="2027-03-30",
            status="Active",
            phase="Phase 1: Winter Sensor Calibration",
            leader="Dr. Amit K. Verma (Atmospheric Physics)",
            personnel_count=16,
            cargo_weight="1.5 Tons",
            readiness=90,
            vessel_support="Research Vessel Lance / Coastal Tender"
        )
        db.add(exp3)
        db.commit()
        db.refresh(exp3)

    # 2. Cargo items if empty
    if db.query(models.Cargo).count() == 0 or getattr(db.query(models.Cargo).first(), "latitude", None) is None:
        db.query(models.CargoMovement).delete()
        db.query(models.Cargo).delete()
        db.commit()

        cargos = [
            models.Cargo(cargo_code="CRG-102", name="Cold-Start Turbines & Power Modules", category="Power Equipment", weight="2.4 Tons", origin="Cape Town Port", destination="Bharati Station", status="Delivered", priority="High", transit_mode="Vessel Landing Barge", rfid_tag="RFID-9941-CT-BHR", temperature_log="-4°C", eta="Delivered", current_location="Bharati Power Hub", stage="Research Station", notes="Successfully integrated into station microgrid.", latitude=-69.4072, longitude=76.1872, expedition_id=exp2.id),
            models.Cargo(cargo_code="CRG-208", name="Emergency Medical & Trauma Cryo-Pack", category="Medical Supplies", weight="0.6 Tons", origin="Goa HQ -> Cape Town", destination="Maitri Station", status="In Transit", priority="Critical", transit_mode="Convoy Alpha (PistenBully)", rfid_tag="RFID-1044-MED-CRYO", temperature_log="-20°C", eta="14 Hours", current_location="Queen Maud Land Traverse", stage="Antarctica", notes="Cold-chain temperature active and monitored.", latitude=-70.7800, longitude=11.7500, expedition_id=exp1.id),
            models.Cargo(cargo_code="CRG-315", name="Deep Ice Core Drilling Rig & Sensors", category="Scientific Instruments", weight="4.8 Tons", origin="NCPOR Labs, Goa", destination="Larsemann Hills Sector 4", status="At Port", priority="Medium", transit_mode="MV Vasiliy Golovnin Bay", rfid_tag="RFID-8812-SCI-DRILL", temperature_log="+2°C", eta="4 Days", current_location="Cape Town Harbor Berth 4", stage="Port", notes="Customs inspected and ready for loading.", latitude=-33.9249, longitude=18.4241, expedition_id=exp2.id),
            models.Cargo(cargo_code="CRG-440", name="Aviation Thermal Fuel JET A-1 (Pod B)", category="Hazardous / Fuel", weight="5.0 Tons", origin="Dakshin Gangotri Depot", destination="Maitri Station Heli-Pad", status="Delayed", priority="High", transit_mode="Convoy Bravo (Heavy Sled)", rfid_tag="RFID-3390-FUEL-JETA1", temperature_log="-26°C", eta="Delayed (Blizzard)", current_location="Ice Shelf Kilometer 24", stage="Antarctica", notes="Delayed by 65 kt Katabatic blizzard.", latitude=-70.1500, longitude=12.0500, expedition_id=exp1.id),
            models.Cargo(cargo_code="CRG-509", name="Glaciology Optical Lidar & Drone Sensors", category="Aviation & Robotics", weight="1.4 Tons", origin="Tromsø Port, Norway", destination="Himadri Arctic Base", status="In Transit", priority="Medium", transit_mode="Coastal Tender MV Polar Queen", rfid_tag="RFID-5521-ROBO-LIDAR", temperature_log="-8°C", eta="18 Hours", current_location="Kongsfjorden Approach", stage="Ship", notes="Shock-monitored packaging intact.", latitude=78.9300, longitude=11.9400, expedition_id=exp3.id),
            models.Cargo(cargo_code="CRG-612", name="PistenBully Heavy Track Replacement Units", category="Machinery Spares", weight="3.2 Tons", origin="Cape Town Depot", destination="Maitri Workshop Bay", status="Loaded", priority="High", transit_mode="MV Vasiliy Golovnin", rfid_tag="RFID-7721-MECH-TRK", temperature_log="-2°C", eta="3 Days", current_location="MV Vasiliy Golovnin Hold 2", stage="Ship", notes="Secured on lower cargo deck.", latitude=-45.0000, longitude=30.0000, expedition_id=exp1.id),
            models.Cargo(cargo_code="CRG-701", name="Cryo-Freeze Nutritional Rations (90-Day Batch)", category="Life Support", weight="3.0 Tons", origin="Mumbai Seaport", destination="Bharati Pantry Hub", status="Delivered", priority="Medium", transit_mode="Container Vessel", rfid_tag="RFID-6612-FOOD-90D", temperature_log="-18°C", eta="Delivered", current_location="Bharati Pantry Bunker", stage="Research Station", notes="Inspected and cataloged in cold-pantry.", latitude=-69.4080, longitude=76.1860, expedition_id=exp2.id),
            models.Cargo(cargo_code="CRG-824", name="Satellite Ground Transceivers & Antennas", category="Comms & Telemetry", weight="0.9 Tons", origin="ISRO Telemetry Depot", destination="Maitri Comms Tower", status="Preparing", priority="High", transit_mode="Airbridge Cargo", rfid_tag="RFID-4419-SAT-ISRO", temperature_log="+10°C", eta="7 Days", current_location="Goa Airbase Logistics Center", stage="Warehouse", notes="Calibration certificates verified.", latitude=15.3800, longitude=73.8300, expedition_id=exp1.id),
            models.Cargo(cargo_code="CRG-930", name="High-Altitude Oxygen Cylinders (50 Units)", category="Life Support", weight="1.8 Tons", origin="Goa HQ", destination="Maitri Station", status="Loaded", priority="Medium", transit_mode="Supply Sled Unit", rfid_tag="RFID-2210-O2-CYL", temperature_log="-15°C", eta="2 Days", current_location="Cape Town Loading Deck", stage="Ship", notes="Pressure gauges verified at 200 bar.", latitude=-33.9249, longitude=18.4241, expedition_id=exp1.id),
            models.Cargo(cargo_code="CRG-988", name="Ocean Hydrothermal Water Sampler Arrays", category="Scientific Instruments", weight="1.2 Tons", origin="NIO Kochi", destination="Prydz Bay Coastal Station", status="At Port", priority="Low", transit_mode="ORV Sagar Kanya", rfid_tag="RFID-1199-OCN-SMPL", temperature_log="+4°C", eta="5 Days", current_location="Kochi Sea Port Berth 2", stage="Port", notes="Awaiting departure schedule.", latitude=9.9312, longitude=76.2673, expedition_id=exp2.id)
        ]
        db.add_all(cargos)
        db.commit()

        sample_movements = [
            models.CargoMovement(cargo_id=cargos[0].id, status="Preparing", location="Cape Town Port Depot", timestamp="2026-08-10 09:30 UTC", notes="Turbines tested and pre-inspected."),
            models.CargoMovement(cargo_id=cargos[0].id, status="At Port", location="Cape Town Harbor Berth 1", timestamp="2026-08-14 14:20 UTC", notes="Customs cleared for polar transport."),
            models.CargoMovement(cargo_id=cargos[0].id, status="Loaded", location="MV Vasiliy Golovnin Deck 1", timestamp="2026-08-18 18:00 UTC", notes="Heavy-lift crane loaded cargo."),
            models.CargoMovement(cargo_id=cargos[0].id, status="In Transit", location="Southern Ocean Sector 4", timestamp="2026-08-25 11:15 UTC", notes="Sea transit in stable conditions."),
            models.CargoMovement(cargo_id=cargos[0].id, status="Delivered", location="Bharati Power Hub", timestamp="2026-09-01 10:30 UTC", notes="Offloaded and integrated into station grid."),

            models.CargoMovement(cargo_id=cargos[1].id, status="Preparing", location="Goa Logistics HQ", timestamp="2026-08-20 08:00 UTC", notes="Trauma kits packed in cryogenic boxes."),
            models.CargoMovement(cargo_id=cargos[1].id, status="At Port", location="Cape Town Airbridge", timestamp="2026-08-24 16:30 UTC", notes="Cold-chain temperature confirmed at -20°C."),
            models.CargoMovement(cargo_id=cargos[1].id, status="In Transit", location="Convoy Alpha (PistenBully 2)", timestamp="2026-08-31 22:00 UTC", notes="Inland traverse across Queen Maud Land."),

            models.CargoMovement(cargo_id=cargos[3].id, status="Preparing", location="Dakshin Gangotri Depot", timestamp="2026-08-28 07:00 UTC", notes="Pumping 6,000L Jet A-1 into sled pods."),
            models.CargoMovement(cargo_id=cargos[3].id, status="In Transit", location="Ice Shelf Sector 2", timestamp="2026-08-30 14:00 UTC", notes="Traverse started with Convoy Bravo."),
            models.CargoMovement(cargo_id=cargos[3].id, status="Delayed", location="Ice Shelf Kilometer 24", timestamp="2026-09-01 08:00 UTC", notes="Sheltered in place due to 65 kt Katabatic storm."),

            models.CargoMovement(cargo_id=cargos[4].id, status="Preparing", location="Tromsø Robotics Lab", timestamp="2026-08-25 10:00 UTC", notes="Calibrated optical sensors."),
            models.CargoMovement(cargo_id=cargos[4].id, status="In Transit", location="Coastal Tender MV Polar Queen", timestamp="2026-08-31 19:00 UTC", notes="Approaching Ny-Ålesund Arctic Fjord.")
        ]
        db.add_all(sample_movements)
        db.commit()

    # 3. Inventory & Transactions
    if db.query(models.Inventory).count() == 0 or db.query(models.Inventory).first().item_code is None:
        db.query(models.InventoryTransaction).delete()
        db.query(models.ExpeditionInventoryRequirement).delete()
        db.query(models.Inventory).delete()
        db.commit()

        ts = "2026-08-20 08:00 UTC"
        inventory_items = [
            models.Inventory(item_code="FUEL-001", item_name="Arctic Aviation Fuel (Jet A-1)", category="Fuel", quantity=39000.0, minimum_quantity=20000.0, unit="Litres", location="Maitri Tank Farm", burn_rate="280 L / Day", days_remaining=139, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="FUEL-002", item_name="Station Heating Arctic Diesel (DFO)", category="Fuel", quantity=28500.0, minimum_quantity=15000.0, unit="Litres", location="Bharati Power Hub", burn_rate="190 L / Day", days_remaining=150, created_at=ts, updated_at=ts, expedition_id=exp2.id),
            models.Inventory(item_code="FUEL-003", item_name="Sub-Zero Snowcat Mobilite Gasoline", category="Fuel", quantity=800.0, minimum_quantity=1000.0, unit="Litres", location="Himadri Fuel Depot", burn_rate="45 L / Day", days_remaining=18, created_at=ts, updated_at=ts, expedition_id=exp3.id),
            
            models.Inventory(item_code="FOOD-101", item_name="Cryo-Dehydrated Emergency Meals", category="Food", quantity=7650.0, minimum_quantity=2500.0, unit="Packs", location="Maitri Central Pantry", burn_rate="42 Packs / Day", days_remaining=182, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="FOOD-102", item_name="Freeze-Dried Vacuum Protein Packs", category="Food", quantity=1800.0, minimum_quantity=1500.0, unit="Packs", location="Bharati Cold Pantry", burn_rate="28 Packs / Day", days_remaining=64, created_at=ts, updated_at=ts, expedition_id=exp2.id),
            models.Inventory(item_code="FOOD-103", item_name="High-Calorie Polar Traverse Biscuits", category="Food", quantity=0.0, minimum_quantity=500.0, unit="Boxes", location="Maitri Outpost Depot", burn_rate="15 Boxes / Day", days_remaining=0, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            
            models.Inventory(item_code="MED-201", item_name="Trauma & Cold-Injury Resuscitation Packs", category="Medical", quantity=32.0, minimum_quantity=80.0, unit="Kits", location="Maitri Infirmary", burn_rate="1.2 Kits / Day", days_remaining=14, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="MED-202", item_name="Epi-Injectors & Frostbite Defrost Ampoules", category="Medical", quantity=18.0, minimum_quantity=50.0, unit="Units", location="Maitri Medical Bay", burn_rate="0.5 Units / Day", days_remaining=12, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="MED-203", item_name="High-Altitude Medical Oxygen Cylinders", category="Medical", quantity=182.0, minimum_quantity=50.0, unit="Cylinders", location="Environmental Pod 3", burn_rate="0.5 Cyl / Day", days_remaining=364, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="MED-204", item_name="Surgical Suture & Sterile Cryo-Scalpels", category="Medical", quantity=0.0, minimum_quantity=25.0, unit="Sets", location="Bharati Surgery Bay", burn_rate="0.2 Sets / Day", days_remaining=0, created_at=ts, updated_at=ts, expedition_id=exp2.id),
            
            models.Inventory(item_code="SCI-301", item_name="Deep Ice Core Drill Bits (Hardened Carbide)", category="Scientific Equipment", quantity=12.0, minimum_quantity=8.0, unit="Units", location="Larsemann Drill Camp", burn_rate="0.1 Units / Mo", days_remaining=120, created_at=ts, updated_at=ts, expedition_id=exp2.id),
            models.Inventory(item_code="SCI-302", item_name="Geomagnetic Cryogenic Magnetometer Probes", category="Scientific Equipment", quantity=4.0, minimum_quantity=6.0, unit="Probes", location="Maitri Geomag Hut", burn_rate="0.05 / Mo", days_remaining=80, created_at=ts, updated_at=ts, expedition_id=exp1.id),

            models.Inventory(item_code="CLOTH-401", item_name="Extreme Cold Thermal Parkas (-60°C)", category="Clothing", quantity=95.0, minimum_quantity=50.0, unit="Suits", location="Locker Bay A", burn_rate="1 Suit / Season", days_remaining=365, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="CLOTH-402", item_name="Glacier Crampons & Polar Insulated Boots", category="Clothing", quantity=38.0, minimum_quantity=30.0, unit="Pairs", location="Himadri Locker", burn_rate="2 Pairs / Mo", days_remaining=190, created_at=ts, updated_at=ts, expedition_id=exp3.id),

            models.Inventory(item_code="COMMS-501", item_name="Satellite Emergency Locator Beacons (PLB)", category="Communication", quantity=48.0, minimum_quantity=30.0, unit="Beacons", location="Comms Dispatch", burn_rate="0.1 / Mo", days_remaining=400, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="COMMS-502", item_name="Dual-Band VHF Antarctic Handheld Radios", category="Communication", quantity=24.0, minimum_quantity=20.0, unit="Radios", location="Bharati Comms Room", burn_rate="0.2 / Mo", days_remaining=120, created_at=ts, updated_at=ts, expedition_id=exp2.id),

            models.Inventory(item_code="SAFE-601", item_name="Glaciology Crevasse Safety Ropes (100m)", category="Safety Equipment", quantity=34.0, minimum_quantity=25.0, unit="Coils", location="Traverse Locker", burn_rate="0.5 Coils / Mo", days_remaining=200, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="SAFE-602", item_name="Avalanche Transceivers & Carbon Probes", category="Safety Equipment", quantity=28.0, minimum_quantity=20.0, unit="Kits", location="Safety Locker Bravo", burn_rate="0.1 Kits / Mo", days_remaining=280, created_at=ts, updated_at=ts, expedition_id=exp2.id),

            models.Inventory(item_code="SPARE-701", item_name="PistenBully Snowcat Polar Track Spares", category="Spare Parts", quantity=16.0, minimum_quantity=10.0, unit="Sets", location="Workshop Bay 2", burn_rate="0.2 Sets / Mo", days_remaining=240, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="SPARE-702", item_name="Snowcat Heavy Hydraulic Fluid (Sub-Zero)", category="Spare Parts", quantity=450.0, minimum_quantity=200.0, unit="Litres", location="Maintenance Shed", burn_rate="2.5 L / Day", days_remaining=180, created_at=ts, updated_at=ts, expedition_id=exp1.id),
            models.Inventory(item_code="SPARE-703", item_name="Thermal Grease & Wind-Turbine De-Icer", category="Spare Parts", quantity=85.0, minimum_quantity=40.0, unit="Canisters", location="Himadri Turbine Shed", burn_rate="1.2 Can / Wk", days_remaining=90, created_at=ts, updated_at=ts, expedition_id=exp3.id),

            models.Inventory(item_code="OTH-801", item_name="Water Treatment Ultrafiltration Membranes", category="Other", quantity=24.0, minimum_quantity=30.0, unit="Filter Sets", location="Priyadarshini Pump House", burn_rate="1 Set / 2 Wks", days_remaining=28, created_at=ts, updated_at=ts, expedition_id=exp1.id)
        ]

        for item in inventory_items:
            item.status = compute_inventory_status(item.quantity, item.minimum_quantity)
        
        db.add_all(inventory_items)
        db.commit()

        transactions = [
            models.InventoryTransaction(inventory_id=inventory_items[0].id, transaction_type="STOCK_IN", quantity=15000.0, previous_quantity=24000.0, new_quantity=39000.0, timestamp="2026-08-15 11:30 UTC", reason="Vessel MV Vasiliy Golovnin bulk fuel discharge.", user="Capt. Ananya Iyer"),
            models.InventoryTransaction(inventory_id=inventory_items[0].id, transaction_type="STOCK_OUT", quantity=1200.0, previous_quantity=40200.0, new_quantity=39000.0, timestamp="2026-08-28 14:00 UTC", reason="Inland traverse snowcat convoy refueling.", user="Er. Tashi Dorje"),
            models.InventoryTransaction(inventory_id=inventory_items[6].id, transaction_type="STOCK_OUT", quantity=20.0, previous_quantity=52.0, new_quantity=32.0, timestamp="2026-08-29 09:15 UTC", reason="Field trauma unit deployment for Crevasse Zone rescue.", user="Lt. Col. Vikramaditya"),
            models.InventoryTransaction(inventory_id=inventory_items[7].id, transaction_type="STOCK_OUT", quantity=12.0, previous_quantity=30.0, new_quantity=18.0, timestamp="2026-08-30 16:20 UTC", reason="Frostbite emergency treatment protocol.", user="Lt. Col. Vikramaditya"),
            models.InventoryTransaction(inventory_id=inventory_items[5].id, transaction_type="STOCK_OUT", quantity=50.0, previous_quantity=50.0, new_quantity=0.0, timestamp="2026-08-31 18:45 UTC", reason="Final traverse expedition ration box depletion.", user="Station Chef Hardeep Singh"),
            models.InventoryTransaction(inventory_id=inventory_items[9].id, transaction_type="ADJUSTMENT", quantity=0.0, previous_quantity=10.0, new_quantity=0.0, timestamp="2026-08-31 20:00 UTC", reason="Quarantine damaged cryo-scalpels post autoclave failure.", user="Dr. Siddharth Sen")
        ]
        db.add_all(transactions)
        db.commit()

        exp_reqs = [
            models.ExpeditionInventoryRequirement(expedition_id=exp1.id, category="Fuel", item_name="Arctic Aviation Fuel (Jet A-1)", required_quantity=30000.0, unit="Litres"),
            models.ExpeditionInventoryRequirement(expedition_id=exp1.id, category="Food", item_name="Cryo-Dehydrated Emergency Meals", required_quantity=5000.0, unit="Packs"),
            models.ExpeditionInventoryRequirement(expedition_id=exp1.id, category="Medical", item_name="Trauma & Cold-Injury Resuscitation Packs", required_quantity=100.0, unit="Kits"),
            models.ExpeditionInventoryRequirement(expedition_id=exp1.id, category="Clothing", item_name="Extreme Cold Thermal Parkas (-60°C)", required_quantity=45.0, unit="Suits"),
            models.ExpeditionInventoryRequirement(expedition_id=exp1.id, category="Communication", item_name="Satellite Emergency Locator Beacons (PLB)", required_quantity=40.0, unit="Beacons"),
            models.ExpeditionInventoryRequirement(expedition_id=exp1.id, category="Spare Parts", item_name="PistenBully Snowcat Polar Track Spares", required_quantity=12.0, unit="Sets"),

            models.ExpeditionInventoryRequirement(expedition_id=exp2.id, category="Fuel", item_name="Station Heating Arctic Diesel (DFO)", required_quantity=20000.0, unit="Litres"),
            models.ExpeditionInventoryRequirement(expedition_id=exp2.id, category="Food", item_name="Freeze-Dried Vacuum Protein Packs", required_quantity=2000.0, unit="Packs"),
            models.ExpeditionInventoryRequirement(expedition_id=exp2.id, category="Scientific Equipment", item_name="Deep Ice Core Drill Bits", required_quantity=10.0, unit="Units"),
            models.ExpeditionInventoryRequirement(expedition_id=exp2.id, category="Safety Equipment", item_name="Avalanche Transceivers", required_quantity=15.0, unit="Kits"),

            models.ExpeditionInventoryRequirement(expedition_id=exp3.id, category="Fuel", item_name="Sub-Zero Snowcat Mobilite Gasoline", required_quantity=1200.0, unit="Litres"),
            models.ExpeditionInventoryRequirement(expedition_id=exp3.id, category="Clothing", item_name="Glacier Crampons & Polar Insulated Boots", required_quantity=25.0, unit="Pairs"),
            models.ExpeditionInventoryRequirement(expedition_id=exp3.id, category="Spare Parts", item_name="Thermal Grease & Wind-Turbine De-Icer", required_quantity=50.0, unit="Canisters")
        ]
        db.add_all(exp_reqs)
        db.commit()

    # 4. Personnel (At least 16 personnel with deterministic GPS coordinates)
    if db.query(models.Personnel).count() == 0 or getattr(db.query(models.Personnel).first(), "latitude", None) is None:
        db.query(models.PersonnelMovement).delete()
        db.query(models.Personnel).delete()
        db.commit()

        ts = "2026-08-25 08:00 UTC"
        personnel_list = [
            models.Personnel(
                personnel_code="P-042", name="Dr. Rajesh Sharma", role="Expedition Leader", department="Science & Research", contact="+91-98230-11002",
                status="FIELD", current_location="Schirmacher Glacier Traverse (Sector 4)", latitude=-70.7500, longitude=11.6800,
                specialization="Ice Sheet Dynamics & Glaciology", heart_rate="74 bpm", spo2="98%", body_temp="36.7°C", battery="88%",
                emergency_contact="+91-98230-99001 (HQ Coordinator)", created_at=ts, last_updated="2026-09-01 09:30 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-019", name="Capt. Ananya Iyer", role="Logistics Officer", department="Logistics & Traverse", contact="+91-94451-22890",
                status="IN_TRANSIT", current_location="Convoy Alpha (PistenBully Snowcat 2)", latitude=-70.8120, longitude=11.8900,
                specialization="Heavy Polar Machinery & Sled Haul", heart_rate="72 bpm", spo2="99%", body_temp="37.0°C", battery="95%",
                emergency_contact="+91-94451-00123", created_at=ts, last_updated="2026-09-01 10:15 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-088", name="Dr. Siddharth Sen", role="Scientist", department="Science & Research", contact="+91-98711-44321",
                status="AT_STATION", current_location="Bharati Station Lidar Laboratory", latitude=-69.4072, longitude=76.1872,
                specialization="Atmospheric Chemistry & Ozone Profiling", heart_rate="68 bpm", spo2="98%", body_temp="36.8°C", battery="92%",
                emergency_contact="+91-98711-88990", created_at=ts, last_updated="2026-09-01 08:00 UTC", expedition_id=exp2.id
            ),
            models.Personnel(
                personnel_code="P-064", name="Lt. Col. Vikramaditya", role="Medical Officer", department="Medical & SAR", contact="+91-99882-77123",
                status="AT_STATION", current_location="Maitri Station Infirmary", latitude=-70.7670, longitude=11.7400,
                specialization="Hypothermia Triage & Trauma Surgery", heart_rate="70 bpm", spo2="99%", body_temp="36.9°C", battery="94%",
                emergency_contact="+91-99882-11445", created_at=ts, last_updated="2026-09-01 07:45 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-031", name="Dr. Meenakshi Sundaram", role="Scientist", department="Science & Research", contact="+91-97120-99412",
                status="FIELD", current_location="Prydz Bay Coastal Core Outpost", latitude=-69.3800, longitude=76.1500,
                specialization="Marine Biogeochemistry & Plankton", heart_rate="71 bpm", spo2="98%", body_temp="36.7°C", battery="86%",
                emergency_contact="+91-97120-33667", created_at=ts, last_updated="2026-09-01 11:00 UTC", expedition_id=exp2.id
            ),
            models.Personnel(
                personnel_code="P-112", name="Er. Tashi Dorje", role="Engineer", department="Engineering & Microgrid", contact="+91-98440-66710",
                status="AT_STATION", current_location="Himadri Arctic Base Main Hut", latitude=78.9236, longitude=11.9286,
                specialization="Wind-Turbine De-icing & Power Grid", heart_rate="66 bpm", spo2="99%", body_temp="36.9°C", battery="97%",
                emergency_contact="+91-98440-55221", created_at=ts, last_updated="2026-09-01 06:30 UTC", expedition_id=exp3.id
            ),
            models.Personnel(
                personnel_code="P-055", name="Dr. Arvind Swaminathan", role="Scientist", department="Science & Research", contact="+91-98112-33445",
                status="RESTING", current_location="Maitri Station Living Habitat Pod 2", latitude=-70.7665, longitude=11.7390,
                specialization="Geomagnetism & Ionospheric Telemetry", heart_rate="62 bpm", spo2="98%", body_temp="36.6°C", battery="90%",
                emergency_contact="+91-98112-77889", created_at=ts, last_updated="2026-09-01 12:00 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-077", name="Kiran Rathore", role="Technician", department="Station Operations", contact="+91-98334-55667",
                status="AT_STATION", current_location="Maitri Satellite Comms Room", latitude=-70.7672, longitude=11.7410,
                specialization="Dual-Band Iridium & VSAT Link", heart_rate="69 bpm", spo2="98%", body_temp="37.0°C", battery="96%",
                emergency_contact="+91-98334-11223", created_at=ts, last_updated="2026-09-01 08:30 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-093", name="Er. Hardeep Singh", role="Engineer", department="Engineering & Microgrid", contact="+91-98556-77889",
                status="AT_STATION", current_location="Bharati Water Filtration Plant", latitude=-69.4080, longitude=76.1860,
                specialization="Sub-Zero Cryogenic Plumbing & HVAC", heart_rate="73 bpm", spo2="99%", body_temp="36.8°C", battery="91%",
                emergency_contact="+91-98556-44332", created_at=ts, last_updated="2026-09-01 09:00 UTC", expedition_id=exp2.id
            ),
            models.Personnel(
                personnel_code="P-105", name="Dr. Sunita Patel", role="Scientist", department="Science & Research", contact="+91-98778-99001",
                status="FIELD", current_location="Larsemann Hills Sediment Camp 2", latitude=-69.4200, longitude=76.2200,
                specialization="Permafrost Core Geochronology", heart_rate="76 bpm", spo2="97%", body_temp="36.6°C", battery="85%",
                emergency_contact="+91-98778-11224", created_at=ts, last_updated="2026-09-01 10:45 UTC", expedition_id=exp2.id
            ),
            models.Personnel(
                personnel_code="P-124", name="Wing Cmdr. Rajiv Menon", role="Pilot", department="Aviation & Transport", contact="+91-98660-12345",
                status="OFF_DUTY", current_location="Cape Town Polar Airbridge Base", latitude=-33.9249, longitude=18.4241,
                specialization="Ski-equipped Twin Otter Polar Flying", heart_rate="64 bpm", spo2="99%", body_temp="36.8°C", battery="99%",
                emergency_contact="+91-98660-54321", created_at=ts, last_updated="2026-09-01 05:00 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-138", name="Govind Nair", role="Field Operator", department="Logistics & Traverse", contact="+91-98450-98765",
                status="IN_TRANSIT", current_location="Dakshin Gangotri Ice Shelf Route", latitude=-70.0750, longitude=12.0800,
                specialization="Crevasse Radar Detection & Route Recon", heart_rate="78 bpm", spo2="98%", body_temp="36.9°C", battery="93%",
                emergency_contact="+91-98450-45678", created_at=ts, last_updated="2026-09-01 11:30 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-149", name="Dr. Elena Rostova", role="Scientist", department="Science & Research", contact="+47-7902-1200",
                status="FIELD", current_location="Kongsfjorden Glacial Mooring Station", latitude=78.9350, longitude=11.9500,
                specialization="Arctic Fjord Hydrography & Ocean Acoustic", heart_rate="70 bpm", spo2="99%", body_temp="36.7°C", battery="89%",
                emergency_contact="+47-7902-9900", created_at=ts, last_updated="2026-09-01 09:15 UTC", expedition_id=exp3.id
            ),
            models.Personnel(
                personnel_code="P-152", name="Deepak Chawla", role="Technician", department="Station Operations", contact="+91-98123-45678",
                status="AT_STATION", current_location="Maitri Workshop Bay 2", latitude=-70.7680, longitude=11.7380,
                specialization="Heavy Generator Overhaul & Hydraulics", heart_rate="72 bpm", spo2="98%", body_temp="36.8°C", battery="92%",
                emergency_contact="+91-98123-98765", created_at=ts, last_updated="2026-09-01 08:15 UTC", expedition_id=exp1.id
            ),
            models.Personnel(
                personnel_code="P-160", name="Dr. Farhan Qureshi", role="Scientist", department="Science & Research", contact="+91-98990-11223",
                status="RESTING", current_location="Bharati Living Quarters Block B", latitude=-69.4070, longitude=76.1880,
                specialization="Upper Atmosphere Solar Wind Telemetry", heart_rate="63 bpm", spo2="99%", body_temp="36.6°C", battery="95%",
                emergency_contact="+91-98990-55667", created_at=ts, last_updated="2026-09-01 12:30 UTC", expedition_id=exp2.id
            ),
            models.Personnel(
                personnel_code="P-175", name="Pooja Deshmukh", role="Field Operator", department="Logistics & Traverse", contact="+91-98221-77889",
                status="AT_STATION", current_location="Ny-Ålesund Clean Air Lab", latitude=78.9067, longitude=11.8883,
                specialization="Arctic Weather Mast Instrumentation", heart_rate="67 bpm", spo2="99%", body_temp="36.9°C", battery="98%",
                emergency_contact="+91-98221-33445", created_at=ts, last_updated="2026-09-01 07:00 UTC", expedition_id=exp3.id
            )
        ]

        db.add_all(personnel_list)
        db.commit()

        # Seed sample movement histories
        movements = [
            models.PersonnelMovement(personnel_id=personnel_list[0].id, previous_location="Maitri Station Living Habitat", new_location="Schirmacher Glacier Traverse (Sector 4)", previous_latitude=-70.7670, previous_longitude=11.7400, new_latitude=-70.7500, new_longitude=11.6800, status="FIELD", movement_type="FIELD_MOVEMENT", notes="Departed on skidoo for annual ablation stake measurement.", timestamp="2026-09-01 09:30 UTC"),
            models.PersonnelMovement(personnel_id=personnel_list[0].id, previous_location="Cape Town Staging Depot", new_location="Maitri Station Living Habitat", previous_latitude=-33.9249, previous_longitude=18.4241, new_latitude=-70.7670, new_longitude=11.7400, status="AT_STATION", movement_type="ARRIVAL", notes="Arrived via chartered airbridge flight IL-76.", timestamp="2026-08-25 14:00 UTC"),

            models.PersonnelMovement(personnel_id=personnel_list[1].id, previous_location="Maitri Station Workshop", new_location="Convoy Alpha (PistenBully Snowcat 2)", previous_latitude=-70.7680, previous_longitude=11.7380, new_latitude=-70.8120, new_longitude=11.8900, status="IN_TRANSIT", movement_type="VEHICLE_MOVEMENT", notes="Leading heavy freight sled convoy toward inland fuel depot.", timestamp="2026-09-01 10:15 UTC"),
            
            models.PersonnelMovement(personnel_id=personnel_list[4].id, previous_location="Bharati Oceanography Lab", new_location="Prydz Bay Coastal Core Outpost", previous_latitude=-69.4072, previous_longitude=76.1872, new_latitude=-69.3800, new_longitude=76.1500, status="FIELD", movement_type="DEPARTURE", notes="Sediment trap recovery along coastal ice edge.", timestamp="2026-09-01 11:00 UTC"),

            models.PersonnelMovement(personnel_id=personnel_list[9].id, previous_location="Bharati Main Habitat", new_location="Larsemann Hills Sediment Camp 2", previous_latitude=-69.4072, previous_longitude=76.1872, new_latitude=-69.4200, new_longitude=76.2200, status="FIELD", movement_type="FIELD_MOVEMENT", notes="Permafrost core drilling operations initiated.", timestamp="2026-09-01 10:45 UTC")
        ]

        db.add_all(movements)
        db.commit()

    # 5. Alerts (At least 5 alerts)
    if db.query(models.Alert).count() == 0:
        alerts = [
            models.Alert(
                type="Distress",
                title="SOS Beacon Triggered — Crevasse Zone Bravo",
                message="Personnel P-042 triggered an automated distress signal at Lat: 70°46.8'S, Long: 11°45.2'E (3.2 km SE of Maitri). Katabatic gust at 45 kt.",
                severity="CRITICAL",
                timestamp="12 mins ago (13:51 UTC)",
                status="IN_PROGRESS",
                source="Personnel Locator P-042",
                action_required="SAR Snowcat Unit Alpha-1 dispatched with Trauma Medic. Estimated Intercept: 18 mins.",
                coordinates="-70.7800, 11.7533"
            ),
            models.Alert(
                type="Resource",
                title="Critical Reserve Breach — Trauma & Cold-Injury Resuscitation Packs (MED-201)",
                message="Stock level for Trauma & Cold-Injury Resuscitation Packs is currently 32.0 Kits, which has breached the safety reserve threshold of 80.0 Kits at Maitri Infirmary.",
                severity="CRITICAL",
                timestamp="1 hr 45 mins ago",
                status="ACTIVE",
                source="Inventory Monitor [MED-201]",
                action_required="Expedite delivery of Cargo CRG-208 via scheduled air-drop or Convoy Alpha rendezvous.",
                coordinates="Maitri Infirmary"
            ),
            models.Alert(
                type="Operational",
                title="Cargo CRG-102 Successfully Received & Verified",
                message="Cargo container CRG-102 containing 2x 150kW High-Efficiency Cold-Start Turbine Generators arrived via coastal landing barge and connected to Bharati grid.",
                severity="INFO",
                timestamp="3 hrs ago",
                status="RESOLVED",
                source="Bharati Station Asset Dock",
                action_required="Asset register updated automatically via Cold-RFID.",
                coordinates="Bharati Station Power Hub"
            ),
            models.Alert(
                type="Weather",
                title="Katabatic Blizzard Warning — Queen Maud Land",
                message="Satellite storm tracking detects severe Katabatic front moving north at 65 kt. Visibility projected under 10 meters within 6 hours across Sector 7-B.",
                severity="WARNING",
                timestamp="5 hrs ago",
                status="MONITORING",
                source="NCPOR Polar Meteorology Center",
                action_required="All non-essential field teams recalled to Maitri & Bharati habitats.",
                coordinates="Sector 7-B Ice Sheet"
            ),
            models.Alert(
                type="Operational",
                title="Himadri Fjord CTD Buoy Telemetry Re-established",
                message="Kongsfjorden underwater mooring acoustic downlink signal restored at 99.4% packet reception rate.",
                severity="INFO",
                timestamp="8 hrs ago",
                status="RESOLVED",
                source="IndARC Acoustic Receiver",
                action_required="Data stream linked to Arctic Data Centre.",
                coordinates="78.9236°N, 11.9286°E"
            )
        ]
        db.add_all(alerts)
        db.commit()

    # 6. Polar Stations & Facilities (At least 10 stations/outposts)
    if db.query(models.Station).count() == 0:
        stations = [
            models.Station(
                name="Maitri Station",
                type="Research Station",
                latitude=-70.7670,
                longitude=11.7400,
                elevation="117m ASL",
                status="OPERATIONAL",
                region="Antarctica - Queen Maud Land",
                description="Year-round Indian scientific research station in Schirmacher Oasis. Operational capacity: 65 personnel.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Bharati Station",
                type="Research Station",
                latitude=-69.4072,
                longitude=76.1872,
                elevation="35m ASL",
                status="OPERATIONAL",
                region="Antarctica - Larsemann Hills",
                description="State-of-the-art Antarctic oceanography and atmospheric physics laboratory overlooking Prydz Bay.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Himadri Arctic Base",
                type="Research Station",
                latitude=78.9236,
                longitude=11.9286,
                elevation="20m ASL",
                status="OPERATIONAL",
                region="Arctic - Svalbard",
                description="India's permanent Arctic research base in Ny-Ålesund, Spitsbergen archipelago.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Dakshin Gangotri Ice Shelf Depot",
                type="Storage Depot",
                latitude=-70.0750,
                longitude=12.0800,
                elevation="45m ASL",
                status="OPERATIONAL",
                region="Antarctica - Ice Shelf",
                description="Coastal ice shelf bulk fuel repository, container staging grounds, and heavy traverse departure depot.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Maitri Storage Bunker",
                type="Storage Depot",
                latitude=-70.7680,
                longitude=11.7380,
                elevation="120m ASL",
                status="OPERATIONAL",
                region="Antarctica - Queen Maud Land",
                description="Reinforced sub-zero cargo bunker housing snowcat parts, lubricants, and turbine modules.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Field Sector A (Schirmacher)",
                type="Field Outpost",
                latitude=-70.7500,
                longitude=11.6800,
                elevation="140m ASL",
                status="SEASONAL_ACTIVE",
                region="Antarctica - Queen Maud Land",
                description="Glaciology field camp with automated weather telemetry and ablation stake monitoring.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Field Sector B (Inland Traverse)",
                type="Field Outpost",
                latitude=-70.8120,
                longitude=11.8900,
                elevation="310m ASL",
                status="SEASONAL_ACTIVE",
                region="Antarctica - Queen Maud Land",
                description="Inland plateau traverse shelter and emergency radio repeater mast.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Larsemann Hills Drill Camp",
                type="Drill Site",
                latitude=-69.4200,
                longitude=76.2200,
                elevation="85m ASL",
                status="SEASONAL_ACTIVE",
                region="Antarctica - Larsemann Hills",
                description="Deep sediment core drilling camp and permafrost cryosphere monitoring site.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Priyadarshini Water Pump House",
                type="Water Facility",
                latitude=-70.7710,
                longitude=11.7350,
                elevation="110m ASL",
                status="OPERATIONAL",
                region="Antarctica - Queen Maud Land",
                description="Freshwater intake and ultrafiltration plant from Lake Priyadarshini.",
                created_at="2026-08-01 00:00 UTC"
            ),
            models.Station(
                name="Cape Town Polar Logistics Center",
                type="Logistics Camp",
                latitude=-33.9249,
                longitude=18.4241,
                elevation="10m ASL",
                status="OPERATIONAL",
                region="South Africa Staging",
                description="International staging port and chartered vessel loading berth for Indian Antarctic expeditions.",
                created_at="2026-08-01 00:00 UTC"
            )
        ]
        db.add_all(stations)
        db.commit()

    # 7. Response Units (At least 7 realistic SAR units)
    if db.query(models.ResponseUnit).count() == 0:
        response_units = [
            models.ResponseUnit(
                unit_code="SAR-01",
                name="Schirmacher SAR Snowcat Alpha",
                unit_type="VEHICLE",
                team="Maitri Base SAR",
                status="DISPATCHED",
                capabilities="Crevasse Extraction, Cold-Winch Towing, Snowcat Mobile Infirmary, Emergency Beacon Tracker",
                current_location="Maitri Station SAR Bay",
                latitude=-70.7670,
                longitude=11.7400,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 10:00 UTC"
            ),
            models.ResponseUnit(
                unit_code="MED-01",
                name="Maitri Field Trauma Medical Team",
                unit_type="MEDICAL_TEAM",
                team="Maitri Base Medical",
                status="AVAILABLE",
                capabilities="Advanced Hypothermia Triage, Cryo-Suture, Oxygen Resuscitation, Trauma Medic Deployment",
                current_location="Maitri Station Infirmary",
                latitude=-70.7670,
                longitude=11.7400,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 08:00 UTC"
            ),
            models.ResponseUnit(
                unit_code="HELI-01",
                name="Polar Rescue Twin-Turbine Heli Alpha",
                unit_type="HELICOPTER",
                team="Antarctic Tactical Airbridge",
                status="AVAILABLE",
                capabilities="Aviation MEDEVAC, Glacier Aerial Reconnaissance, Long-Range Sled Air-Drop",
                current_location="Maitri Heli-Pad Terminal",
                latitude=-70.7660,
                longitude=11.7420,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 08:00 UTC"
            ),
            models.ResponseUnit(
                unit_code="SAR-02",
                name="Larsemann Hills Coastal SAR Tender",
                unit_type="RESCUE_TEAM",
                team="Bharati Coastal SAR",
                status="AVAILABLE",
                capabilities="Fast Ice Extraction, Sea-Ice Diver Rescue, Fjord Amphibious Tender, Radio Triangulation",
                current_location="Bharati Station Marine Bay",
                latitude=-69.4072,
                longitude=76.1872,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 08:00 UTC"
            ),
            models.ResponseUnit(
                unit_code="MED-02",
                name="Bharati Emergency Medical Evacuation Pod",
                unit_type="MEDICAL_TEAM",
                team="Bharati Base Medical",
                status="AVAILABLE",
                capabilities="Frostbite Critical Care, Emergency Life-Support, Mobile Cryo-Preservation",
                current_location="Bharati Station Medical Unit",
                latitude=-69.4072,
                longitude=76.1872,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 08:00 UTC"
            ),
            models.ResponseUnit(
                unit_code="SAR-03",
                name="Himadri Arctic Fjord Patrol & Glaciology Squad",
                unit_type="FIELD_TEAM",
                team="Himadri Arctic Team",
                status="AVAILABLE",
                capabilities="Glacier Crevasse Safety, Arctic Blizzard Survival, High-Latitude Radio Relay",
                current_location="Himadri Arctic Base Main Hut",
                latitude=78.9236,
                longitude=11.9286,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 08:00 UTC"
            ),
            models.ResponseUnit(
                unit_code="TECH-01",
                name="Maitri Heavy Machinery Recovery Cat",
                unit_type="STATION_SUPPORT",
                team="Logistics Traverse Support",
                status="ON_MISSION",
                capabilities="Sub-Zero Engine Overhaul, Heavy Sled Recovery, Generator Emergency Bypass",
                current_location="Maitri Workshop Bay 2",
                latitude=-70.7680,
                longitude=11.7380,
                created_at="2026-08-01 00:00 UTC",
                updated_at="2026-09-01 09:30 UTC"
            )
        ]
        db.add_all(response_units)
        db.commit()

    # 8. Emergency Incidents & Audit History (At least 5 realistic incidents)
    if db.query(models.Incident).count() == 0:
        p1 = db.query(models.Personnel).filter(models.Personnel.personnel_code == "P-042").first()
        p2 = db.query(models.Personnel).filter(models.Personnel.personnel_code == "P-019").first()
        u1 = db.query(models.ResponseUnit).filter(models.ResponseUnit.unit_code == "SAR-01").first()
        u7 = db.query(models.ResponseUnit).filter(models.ResponseUnit.unit_code == "TECH-01").first()

        incidents = [
            models.Incident(
                incident_code="INC-2026-001",
                title="Distress Beacon Triggered — Crevasse Zone Sector 4",
                incident_type="MEDICAL",
                severity="CRITICAL",
                status="DISPATCHED",
                personnel_id=p1.id if p1 else None,
                reported_by="Dr. Rajesh Sharma (P-042)",
                latitude=-70.7500,
                longitude=11.6800,
                location_name="Schirmacher Glacier Traverse (Sector 4)",
                description="Dr. Rajesh Sharma triggered automated distress beacon after skidoo track slipped near an active crevasse lip in Sector 4. Sustained minor leg injury.",
                assigned_unit_id=u1.id if u1 else None,
                created_at="2026-09-01 09:35 UTC",
                acknowledged_at="2026-09-01 09:38 UTC",
                dispatched_at="2026-09-01 09:45 UTC"
            ),
            models.Incident(
                incident_code="INC-2026-002",
                title="Critical Reserve Breach — Trauma & Cold-Injury Packs",
                incident_type="CARGO",
                severity="HIGH",
                status="TRIAGED",
                personnel_id=None,
                reported_by="Inventory Telemetry Monitor",
                latitude=-70.7670,
                longitude=11.7400,
                location_name="Maitri Infirmary Storage",
                description="Trauma kit inventory breached threshold (32/80 Kits). Expedited airlift/traverse requested.",
                assigned_unit_id=None,
                created_at="2026-09-01 07:15 UTC",
                acknowledged_at="2026-09-01 07:20 UTC"
            ),
            models.Incident(
                incident_code="INC-2026-003",
                title="Snowcat Heavy Hydraulic Pressure Loss on Freight Traverse",
                incident_type="VEHICLE",
                severity="HIGH",
                status="IN_PROGRESS",
                personnel_id=p2.id if p2 else None,
                reported_by="Capt. Ananya Iyer (P-019)",
                latitude=-70.8120,
                longitude=11.8900,
                location_name="Convoy Alpha (PistenBully Snowcat 2)",
                description="Main hydraulic line burst on heavy sled traverse 14 km southeast of Maitri. Immobile in sub-zero blizzard.",
                assigned_unit_id=u7.id if u7 else None,
                created_at="2026-09-01 08:30 UTC",
                acknowledged_at="2026-09-01 08:32 UTC",
                dispatched_at="2026-09-01 08:40 UTC"
            ),
            models.Incident(
                incident_code="INC-2026-004",
                title="Kongsfjorden Underwater Acoustic Downlink Interruption",
                incident_type="COMMUNICATION_LOSS",
                severity="MEDIUM",
                status="RESOLVED",
                personnel_id=None,
                reported_by="IndARC Telemetry Receiver",
                latitude=78.9350,
                longitude=11.9500,
                location_name="Kongsfjorden Fjord Sector",
                description="Underwater CTD acoustic downlink signal lost for 4 hours due to antenna ice buildup.",
                assigned_unit_id=None,
                created_at="2026-09-01 04:00 UTC",
                acknowledged_at="2026-09-01 04:10 UTC",
                resolved_at="2026-09-01 08:00 UTC",
                resolution_notes="Antenna de-icing applied. Signal restored at 99.4% packet throughput. Incident closed."
            ),
            models.Incident(
                incident_code="INC-2026-005",
                title="Severe Katabatic Blizzard Approaching Queen Maud Land",
                incident_type="WEATHER_ENVIRONMENTAL",
                severity="HIGH",
                status="REPORTED",
                personnel_id=None,
                reported_by="NCPOR Polar Meteorology Center",
                latitude=-70.1500,
                longitude=12.0500,
                location_name="Sector 7-B Ice Sheet",
                description="65 kt storm front detected on satellite imagery. Visual limit projected under 10 meters.",
                assigned_unit_id=None,
                created_at="2026-09-01 06:00 UTC"
            )
        ]
        db.add_all(incidents)
        db.commit()

        # Seed incident events
        events = [
            models.IncidentEvent(incident_id=incidents[0].id, event_type="INCIDENT_CREATED", previous_status=None, new_status="REPORTED", notes="Automated distress beacon activated by P-042.", actor="Dr. Rajesh Sharma", timestamp="2026-09-01 09:35 UTC"),
            models.IncidentEvent(incident_id=incidents[0].id, event_type="INCIDENT_ACKNOWLEDGED", previous_status="REPORTED", new_status="ACKNOWLEDGED", notes="Distress beacon acknowledged. Station SAR standby initiated.", actor="Lt. Col. Vikramaditya", timestamp="2026-09-01 09:38 UTC"),
            models.IncidentEvent(incident_id=incidents[0].id, event_type="TRIAGE_UPDATED", previous_status="ACKNOWLEDGED", new_status="TRIAGED", notes="Triage confirmed CRITICAL hypothermia risk.", actor="Operations Commander", timestamp="2026-09-01 09:40 UTC"),
            models.IncidentEvent(incident_id=incidents[0].id, event_type="UNIT_ASSIGNED", previous_status="TRIAGED", new_status="TRIAGED", notes="Assigned unit SAR-01 (Schirmacher SAR Snowcat Alpha).", actor="SAR Dispatcher", timestamp="2026-09-01 09:42 UTC"),
            models.IncidentEvent(incident_id=incidents[0].id, event_type="UNIT_DISPATCHED", previous_status="TRIAGED", new_status="DISPATCHED", notes="SAR Snowcat Alpha departed Maitri Station bay toward Sector 4.", actor="SAR Dispatcher", timestamp="2026-09-01 09:45 UTC"),

            models.IncidentEvent(incident_id=incidents[1].id, event_type="INCIDENT_CREATED", previous_status=None, new_status="REPORTED", notes="Safety inventory threshold alert.", actor="Inventory Monitor", timestamp="2026-09-01 07:15 UTC"),
            models.IncidentEvent(incident_id=incidents[1].id, event_type="INCIDENT_ACKNOWLEDGED", previous_status="REPORTED", new_status="ACKNOWLEDGED", notes="Acknowledged by logistics officer.", actor="Capt. Ananya Iyer", timestamp="2026-09-01 07:20 UTC"),
            models.IncidentEvent(incident_id=incidents[1].id, event_type="TRIAGE_UPDATED", previous_status="ACKNOWLEDGED", new_status="TRIAGED", notes="High priority reorder flagged.", actor="Logistics Director", timestamp="2026-09-01 07:25 UTC"),

            models.IncidentEvent(incident_id=incidents[2].id, event_type="INCIDENT_CREATED", previous_status=None, new_status="REPORTED", notes="Vehicle breakdown reported on convoy radio.", actor="Capt. Ananya Iyer", timestamp="2026-09-01 08:30 UTC"),
            models.IncidentEvent(incident_id=incidents[2].id, event_type="UNIT_ASSIGNED", previous_status="REPORTED", new_status="REPORTED", notes="Heavy Recovery Cat assigned.", actor="Traverse Lead", timestamp="2026-09-01 08:35 UTC"),
            models.IncidentEvent(incident_id=incidents[2].id, event_type="UNIT_DISPATCHED", previous_status="REPORTED", new_status="DISPATCHED", notes="TECH-01 dispatched with spare hydraulic lines.", actor="Traverse Lead", timestamp="2026-09-01 08:40 UTC"),
            models.IncidentEvent(incident_id=incidents[2].id, event_type="INCIDENT_STARTED", previous_status="DISPATCHED", new_status="IN_PROGRESS", notes="On-site repair and field tow operation started.", actor="Deepak Chawla", timestamp="2026-09-01 09:10 UTC"),

            models.IncidentEvent(incident_id=incidents[3].id, event_type="INCIDENT_CREATED", previous_status=None, new_status="REPORTED", notes="Downlink lost.", actor="Telemetry System", timestamp="2026-09-01 04:00 UTC"),
            models.IncidentEvent(incident_id=incidents[3].id, event_type="INCIDENT_RESOLVED", previous_status="REPORTED", new_status="RESOLVED", notes="Antenna de-icing applied. Signal restored at 99.4% packet throughput. Incident closed.", actor="Er. Tashi Dorje", timestamp="2026-09-01 08:00 UTC"),

            models.IncidentEvent(incident_id=incidents[4].id, event_type="INCIDENT_CREATED", previous_status=None, new_status="REPORTED", notes="Storm advisory registered.", actor="NCPOR Polar Meteorology Center", timestamp="2026-09-01 06:00 UTC")
        ]
        db.add_all(events)
        db.commit()

    # 9. Seed Users (Task 9: Authentication & RBAC)
    if db.query(models.User).count() == 0:
        from .auth import hash_password
        dev_password_hash = hash_password("Polar@2026")

        users = [
            models.User(
                username="admin",
                full_name="Dr. Anirban Mukherjee",
                email="admin.mukherjee@ncpor.res.in",
                password_hash=dev_password_hash,
                role="ADMIN",
                active=True,
                station="NCPOR Directorate / Maitri",
                created_at="2026-08-01 00:00 UTC",
                last_login="2026-09-02 08:30 UTC"
            ),
            models.User(
                username="director",
                full_name="Dr. Sailesh Raman",
                email="director.raman@ncpor.res.in",
                password_hash=dev_password_hash,
                role="EXPEDITION_DIRECTOR",
                active=True,
                station="43rd ISEA Operations",
                created_at="2026-08-01 00:00 UTC",
                last_login="2026-09-02 09:15 UTC"
            ),
            models.User(
                username="logistics",
                full_name="Lt. Cdr. Priya Nair",
                email="logistics.nair@ncpor.res.in",
                password_hash=dev_password_hash,
                role="LOGISTICS_OFFICER",
                active=True,
                station="Maitri Supply Depot",
                created_at="2026-08-01 00:00 UTC",
                last_login="2026-09-02 07:45 UTC"
            ),
            models.User(
                username="leader",
                full_name="Capt. Ananya Iyer",
                email="leader.iyer@ncpor.res.in",
                password_hash=dev_password_hash,
                role="EXPEDITION_LEADER",
                active=True,
                station="Schirmacher Oasis Field Base",
                created_at="2026-08-01 00:00 UTC",
                last_login="2026-09-01 18:20 UTC"
            ),
            models.User(
                username="sar",
                full_name="Lt. Col. Vikramaditya",
                email="sar.vikramaditya@ncpor.res.in",
                password_hash=dev_password_hash,
                role="SAR_OFFICER",
                active=True,
                station="Bharati SAR Quick Response Unit",
                created_at="2026-08-01 00:00 UTC",
                last_login="2026-09-02 09:00 UTC"
            ),
            models.User(
                username="field",
                full_name="Dr. Vikram Sethi",
                email="field.sethi@ncpor.res.in",
                password_hash=dev_password_hash,
                role="FIELD_OPERATOR",
                active=True,
                station="Himadri Station (Ny-Ålesund)",
                created_at="2026-08-01 00:00 UTC",
                last_login="2026-09-01 14:10 UTC"
            )
        ]
        db.add_all(users)
        db.commit()

    # Ensure users table has assigned_station_id column in existing SQLite DBs
    try:
        from sqlalchemy import text
        res = db.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in res.fetchall()]
        if "assigned_station_id" not in columns:
            db.execute(text("ALTER TABLE users ADD COLUMN assigned_station_id INTEGER REFERENCES stations(id)"))
            db.commit()
    except Exception as e:
        db.rollback()

    # 10. Seed Station Head Accounts & Link Assigned Stations
    from .auth import hash_password
    dev_password_hash = hash_password("Polar@2026")
    maitri_station = db.query(models.Station).filter(models.Station.name.ilike("%Maitri Station%")).first() or db.query(models.Station).filter(models.Station.name.ilike("%Maitri%")).first()
    himadri_station = db.query(models.Station).filter(models.Station.name.ilike("%Himadri%")).first()
    bharati_station = db.query(models.Station).filter(models.Station.name.ilike("%Bharati%")).first()

    head_maitri = db.query(models.User).filter(models.User.username == "head.maitri").first()
    if not head_maitri:
        head_maitri = models.User(
            username="head.maitri",
            full_name="Dr. Tenzing Norbu",
            email="head.maitri@ncpor.res.in",
            password_hash=dev_password_hash,
            role="STATION_HEAD",
            active=True,
            station=maitri_station.name if maitri_station else "Maitri Station",
            assigned_station_id=maitri_station.id if maitri_station else None,
            created_at="2026-08-01 00:00 UTC",
            last_login="2026-09-02 08:30 UTC"
        )
        db.add(head_maitri)
        db.commit()
    elif maitri_station and not head_maitri.assigned_station_id:
        head_maitri.assigned_station_id = maitri_station.id
        db.commit()

    head_himadri = db.query(models.User).filter(models.User.username == "head.himadri").first()
    if not head_himadri:
        head_himadri = models.User(
            username="head.himadri",
            full_name="Dr. Amit K. Verma",
            email="head.himadri@ncpor.res.in",
            password_hash=dev_password_hash,
            role="STATION_HEAD",
            active=True,
            station=himadri_station.name if himadri_station else "Himadri Arctic Base",
            assigned_station_id=himadri_station.id if himadri_station else None,
            created_at="2026-08-01 00:00 UTC",
            last_login="2026-09-02 08:30 UTC"
        )
        db.add(head_himadri)
        db.commit()
    elif himadri_station and not head_himadri.assigned_station_id:
        head_himadri.assigned_station_id = himadri_station.id
        db.commit()

    # Seed baseline Station Resource Requirements (Himadri FUEL-003 1000L, FOOD-101 2500 Packs)
    if db.query(models.StationResourceRequirement).count() == 0:
        ts = "2026-08-20 08:00 UTC"
        baseline_reqs = []
        if himadri_station:
            baseline_reqs.extend([
                models.StationResourceRequirement(
                    station_id=himadri_station.id,
                    item_code="FUEL-003",
                    item_name="Sub-Zero Snowcat Mobilite Gasoline",
                    minimum_quantity=1000.0,
                    unit="Litres",
                    is_active=True,
                    created_at=ts,
                    updated_at=ts
                ),
                models.StationResourceRequirement(
                    station_id=himadri_station.id,
                    item_code="FOOD-101",
                    item_name="Cryo-Dehydrated Emergency Meals",
                    minimum_quantity=2500.0,
                    unit="Packs",
                    is_active=True,
                    created_at=ts,
                    updated_at=ts
                )
            ])
        if maitri_station:
            baseline_reqs.extend([
                models.StationResourceRequirement(
                    station_id=maitri_station.id,
                    item_code="FUEL-001",
                    item_name="Arctic Aviation Fuel (Jet A-1)",
                    minimum_quantity=20000.0,
                    unit="Litres",
                    is_active=True,
                    created_at=ts,
                    updated_at=ts
                ),
                models.StationResourceRequirement(
                    station_id=maitri_station.id,
                    item_code="FOOD-101",
                    item_name="Cryo-Dehydrated Emergency Meals",
                    minimum_quantity=2500.0,
                    unit="Packs",
                    is_active=True,
                    created_at=ts,
                    updated_at=ts
                )
            ])
        if baseline_reqs:
            db.add_all(baseline_reqs)
            db.commit()

    # 11. Seed System Settings (Task 11: System Configuration)
    default_settings_defs = [
        # ── System ───────────────────────────────────────────────────────
        ("system_name", "POLAR-X Command", "string",
         "System Name", "Displayed application name.", "system"),
        ("organization_name", "Ministry of Earth Sciences (MoES) / NCPOR", "string",
         "Organization / Department", "Owning organization shown in reports and headers.", "system"),
        ("deployment_environment", "Antarctic Polar Expedition", "string",
         "Deployment Environment", "Operational environment descriptor.", "system"),

        # ── Operational Thresholds ────────────────────────────────────────
        ("readiness_warning_threshold", "70", "integer",
         "Readiness Warning Threshold (%)", "Below this readiness score an expedition is flagged ATTENTION.", "operational"),
        ("readiness_critical_threshold", "50", "integer",
         "Readiness Critical Threshold (%)", "Below this readiness score an expedition is flagged AT_RISK.", "operational"),
        ("inventory_low_stock_ratio", "1.5", "float",
         "Inventory Low-Stock Ratio", "qty <= min_qty * ratio triggers LOW_STOCK status.", "operational"),
        ("inventory_critical_ratio", "1.0", "float",
         "Inventory Critical Ratio", "qty < min_qty * ratio triggers CRITICAL status.", "operational"),
        ("location_freshness_hours", "6", "integer",
         "Location Freshness Threshold (hours)", "Personnel/cargo location considered stale after this many hours.", "operational"),
        ("default_report_days", "30", "integer",
         "Default Report Date Range (days)", "Default lookback window used in the Reports module.", "operational"),

        # ── Notifications ─────────────────────────────────────────────────
        ("emergency_notifications_enabled", "true", "boolean",
         "Emergency Alert Notifications", "Enable system-level emergency incident notifications.", "notifications"),
        ("critical_incident_notifications_enabled", "true", "boolean",
         "Critical Incident Notifications", "Enable notifications for CRITICAL severity incidents.", "notifications"),

        # ── Smart Automation ──────────────────────────────────────────────
        ("automation_enabled", "true", "boolean",
         "Smart Automation Engine", "Enable predictive risk scoring and automation recommendations.", "automation"),
        ("automation_inventory_risk_high_threshold", "50", "integer",
         "Inventory Risk HIGH Threshold (%)", "Risk score ≥ this value is classified HIGH.", "automation"),
        ("automation_inventory_risk_critical_threshold", "75", "integer",
         "Inventory Risk CRITICAL Threshold (%)", "Risk score ≥ this value is classified CRITICAL.", "automation"),
        ("automation_cargo_risk_high_threshold", "45", "integer",
         "Cargo Risk HIGH Threshold (%)", "Risk score ≥ this value is classified HIGH for cargo.", "automation"),
        ("automation_cargo_risk_critical_threshold", "70", "integer",
         "Cargo Risk CRITICAL Threshold (%)", "Risk score ≥ this value is classified CRITICAL for cargo.", "automation"),
    ]
    existing_keys = {s.key for s in db.query(models.SystemSetting.key).all()}
    missing_settings = []
    ts = get_current_timestamp()
    for key, val, dt, lbl, desc, cat in default_settings_defs:
        if key not in existing_keys:
            missing_settings.append(models.SystemSetting(
                key=key, value=val, data_type=dt, label=lbl,
                description=desc, category=cat, updated_by="system", updated_at=ts
            ))
    if missing_settings:
        db.add_all(missing_settings)
        db.commit()


# ─── SETTINGS CRUD ─────────────────────────────────────────────────────────────

VALID_KEYS = {
    "system_name", "organization_name", "deployment_environment",
    "readiness_warning_threshold", "readiness_critical_threshold",
    "inventory_low_stock_ratio", "inventory_critical_ratio",
    "location_freshness_hours", "default_report_days",
    "emergency_notifications_enabled", "critical_incident_notifications_enabled",
    "automation_enabled",
    "automation_inventory_risk_high_threshold", "automation_inventory_risk_critical_threshold",
    "automation_cargo_risk_high_threshold", "automation_cargo_risk_critical_threshold",
}

SETTING_RANGES = {
    "readiness_warning_threshold":               (1,   100),
    "readiness_critical_threshold":              (1,   100),
    "inventory_low_stock_ratio":                 (1.0, 5.0),
    "inventory_critical_ratio":                  (0.5, 3.0),
    "location_freshness_hours":                  (1,   168),
    "default_report_days":                       (1,   365),
    "automation_inventory_risk_high_threshold":  (10,  100),
    "automation_inventory_risk_critical_threshold": (10, 100),
    "automation_cargo_risk_high_threshold":      (10,  100),
    "automation_cargo_risk_critical_threshold":  (10,  100),
}


def _cast_setting_value(value: str, data_type: str):
    """Cast string value to the correct Python type."""
    if data_type == "integer":
        return int(value)
    elif data_type == "float":
        return float(value)
    elif data_type == "boolean":
        return value.lower() in ("true", "1", "yes")
    return value


def get_all_settings(db: Session) -> dict:
    """Return all settings as a typed flat dict {key: typed_value}."""
    rows = db.query(models.SystemSetting).all()
    return {row.key: _cast_setting_value(row.value, row.data_type) for row in rows}


def get_settings_list(db: Session):
    """Return all SystemSetting ORM objects (for full schema output)."""
    return db.query(models.SystemSetting).order_by(models.SystemSetting.category, models.SystemSetting.key).all()


def get_setting_value(db: Session, key: str, default=None):
    """Return a single setting as its typed Python value."""
    row = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
    if row is None:
        return default
    return _cast_setting_value(row.value, row.data_type)


def validate_settings_update(updates: list, db: Session = None) -> list:
    """
    Validate a list of {key, value} dicts.
    Returns list of error strings; empty list means valid.
    """
    errors = []
    keys_seen = set()
    pending = {u["key"]: u["value"] for u in updates}

    for u in updates:
        key = u["key"]
        value = u["value"]

        if key not in VALID_KEYS:
            errors.append(f"Unknown setting key: '{key}'.")
            continue

        if key in keys_seen:
            errors.append(f"Duplicate key in request: '{key}'.")
            continue
        keys_seen.add(key)

        # Validate non-empty string fields
        if key in ("system_name", "organization_name", "deployment_environment"):
            if not str(value).strip():
                errors.append(f"'{key}' cannot be empty or blank.")

        # Validate boolean fields
        if key in ("emergency_notifications_enabled", "critical_incident_notifications_enabled", "automation_enabled"):
            val_str = str(value).lower().strip()
            if val_str not in ("true", "false", "1", "0", "yes", "no"):
                errors.append(f"'{key}' must be a valid boolean ('true' or 'false', got '{value}').")

        # Validate by range
        if key in SETTING_RANGES:
            lo, hi = SETTING_RANGES[key]
            try:
                num = float(value)
                if num < lo or num > hi:
                    errors.append(f"'{key}' must be between {lo} and {hi} (got {value}).")
            except ValueError:
                errors.append(f"'{key}' requires a numeric value (got '{value}').")

    # Cross-validate: warning > critical for readiness
    warn_val = pending.get("readiness_warning_threshold")
    crit_val = pending.get("readiness_critical_threshold")
    if db is not None:
        if warn_val is None and crit_val is not None:
            warn_val = get_setting_value(db, "readiness_warning_threshold", 70)
        elif crit_val is None and warn_val is not None:
            crit_val = get_setting_value(db, "readiness_critical_threshold", 50)
    if warn_val is not None and crit_val is not None:
        try:
            warn = float(warn_val)
            crit = float(crit_val)
            if crit >= warn:
                errors.append(
                    f"readiness_critical_threshold ({crit}%) must be strictly less than "
                    f"readiness_warning_threshold ({warn}%)."
                )
        except ValueError:
            pass

    # Cross-validate: inventory_low_stock_ratio > inventory_critical_ratio
    ls_val = pending.get("inventory_low_stock_ratio")
    cr_val = pending.get("inventory_critical_ratio")
    if db is not None:
        if ls_val is None and cr_val is not None:
            ls_val = get_setting_value(db, "inventory_low_stock_ratio", 1.5)
        elif cr_val is None and ls_val is not None:
            cr_val = get_setting_value(db, "inventory_critical_ratio", 1.0)
    if ls_val is not None and cr_val is not None:
        try:
            ls = float(ls_val)
            cr = float(cr_val)
            if ls <= cr:
                errors.append(
                    f"inventory_low_stock_ratio ({ls}) must be greater than "
                    f"inventory_critical_ratio ({cr})."
                )
        except ValueError:
            pass

    # Cross-validate: high < critical for automation thresholds
    for prefix in ["automation_inventory_risk", "automation_cargo_risk"]:
        high_key = f"{prefix}_high_threshold"
        crit_key = f"{prefix}_critical_threshold"
        h_val = pending.get(high_key)
        c_val = pending.get(crit_key)
        if db is not None:
            if h_val is None and c_val is not None:
                h_val = get_setting_value(db, high_key, 50 if "inventory" in prefix else 45)
            elif c_val is None and h_val is not None:
                c_val = get_setting_value(db, crit_key, 75 if "inventory" in prefix else 70)
        if h_val is not None and c_val is not None:
            try:
                h = float(h_val)
                c = float(c_val)
                if c <= h:
                    errors.append(
                        f"{crit_key} ({c}%) must be greater than {high_key} ({h}%)."
                    )
            except ValueError:
                pass

    return errors


def update_settings(db: Session, updates: list, updated_by: str = "admin") -> list:
    """
    Apply a list of {key, value} updates.
    Assumes validation already passed.
    Returns list of updated SettingOut objects.
    """
    ts = get_current_timestamp()
    updated = []
    for u in updates:
        row = db.query(models.SystemSetting).filter(models.SystemSetting.key == u["key"]).first()
        if row:
            row.value = str(u["value"])
            row.updated_by = updated_by
            row.updated_at = ts
            updated.append(row)
    db.commit()
    for row in updated:
        db.refresh(row)
    return updated
