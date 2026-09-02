"""
POLAR-X — System Settings Router (Task 11)
Endpoints:
  GET        /api/settings           — All authenticated users (read system settings & thresholds)
  GET        /api/settings/all       — All settings rows with metadata (ADMIN + Director)
  PUT, PATCH /api/settings           — Update settings (ADMIN only)
  GET        /api/settings/defaults  — Get defaults without changing DB (ADMIN only)
  GET        /api/settings/reset     — Alias for defaults
"""

from typing import List, Union, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas, crud
from ..auth import get_current_user, require_roles

router = APIRouter(
    prefix="/api/settings",
    tags=["System Settings & Configuration"]
)


@router.get("", response_model=schemas.SettingsBulkOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieve all system settings as a typed flat dict along with item metadata.
    Accessible by any authenticated user so operational modules and UI can consume thresholds.
    """
    all_settings = crud.get_all_settings(db)
    rows = crud.get_settings_list(db)
    last_updated = None
    if rows:
        ts_list = [r.updated_at for r in rows if r.updated_at]
        last_updated = max(ts_list) if ts_list else None

    items_out = [schemas.SettingOut.model_validate(r) for r in rows] if rows else []

    return schemas.SettingsBulkOut(
        settings=all_settings,
        updated_at=last_updated,
        items=items_out,
        **all_settings
    )


@router.get("/all", response_model=List[schemas.SettingOut])
def get_settings_detail(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["ADMIN", "EXPEDITION_DIRECTOR"])
    )
):
    """
    Retrieve full settings list with metadata (labels, descriptions, categories).
    ADMIN and EXPEDITION_DIRECTOR only.
    """
    return crud.get_settings_list(db)


def _process_settings_update(request: Any, db: Session, current_user: models.User):
    updates_raw = []

    if isinstance(request, schemas.SettingsUpdateRequest):
        updates_raw = [{"key": u.key, "value": str(u.value)} for u in request.updates]
    elif isinstance(request, dict):
        if "updates" in request and isinstance(request["updates"], list):
            for item in request["updates"]:
                if isinstance(item, dict) and "key" in item:
                    updates_raw.append({"key": str(item["key"]), "value": str(item.get("value", ""))})
                elif hasattr(item, "key"):
                    updates_raw.append({"key": str(item.key), "value": str(item.value)})
        else:
            for k, v in request.items():
                updates_raw.append({"key": str(k), "value": str(v)})
    elif isinstance(request, list):
        for item in request:
            if isinstance(item, dict) and "key" in item:
                updates_raw.append({"key": str(item["key"]), "value": str(item.get("value", ""))})
            elif hasattr(item, "key"):
                updates_raw.append({"key": str(item.key), "value": str(item.value)})

    if not updates_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings updates provided."
        )

    errors = crud.validate_settings_update(updates_raw, db=db)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"message": "Settings validation failed.", "errors": errors}
        )

    updated = crud.update_settings(db, updates_raw, updated_by=current_user.username)
    return updated


@router.put("", response_model=List[schemas.SettingOut])
def update_settings_put(
    request: Union[schemas.SettingsUpdateRequest, Dict[str, Any], List[Dict[str, Any]]] = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["ADMIN"]))
):
    """
    Update one or more system settings via PUT.
    ADMIN only. Validates ranges, types, and cross-setting constraints.
    """
    return _process_settings_update(request, db, current_user)


@router.patch("", response_model=List[schemas.SettingOut])
def update_settings_patch(
    request: Union[schemas.SettingsUpdateRequest, Dict[str, Any], List[Dict[str, Any]]] = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["ADMIN"]))
):
    """
    Update one or more system settings via PATCH.
    ADMIN only. Validates ranges, types, and cross-setting constraints.
    """
    return _process_settings_update(request, db, current_user)


DEFAULT_SYSTEM_SETTINGS = {
    "system_name": "POLAR-X Command",
    "organization_name": "Ministry of Earth Sciences (MoES) / NCPOR",
    "deployment_environment": "Antarctic Polar Expedition",
    "readiness_warning_threshold": 70,
    "readiness_critical_threshold": 50,
    "inventory_low_stock_ratio": 1.5,
    "inventory_critical_ratio": 1.0,
    "location_freshness_hours": 6,
    "default_report_days": 30,
    "emergency_notifications_enabled": True,
    "critical_incident_notifications_enabled": True,
    "automation_enabled": True,
    "automation_inventory_risk_high_threshold": 50,
    "automation_inventory_risk_critical_threshold": 75,
    "automation_cargo_risk_high_threshold": 45,
    "automation_cargo_risk_critical_threshold": 70,
}


@router.get("/defaults")
def get_defaults(
    current_user: models.User = Depends(require_roles(["ADMIN"]))
):
    """
    Return the hard-coded default values for all settings, without changing the database.
    ADMIN only. Useful for the 'Reset to Defaults' UI action.
    """
    return DEFAULT_SYSTEM_SETTINGS


@router.get("/reset")
def get_defaults_reset(
    current_user: models.User = Depends(require_roles(["ADMIN"]))
):
    """Alias for /defaults."""
    return DEFAULT_SYSTEM_SETTINGS

