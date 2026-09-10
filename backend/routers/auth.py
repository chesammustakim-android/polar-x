from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_role_permissions
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication & RBAC"]
)

DEMO_ACCOUNTS = [
    {
        "username": "admin",
        "full_name": "Dr. Anirban Mukherjee",
        "role": "ADMIN",
        "role_description": "Full Command & System Access",
        "station": "NCPOR Directorate / Maitri"
    },
    {
        "username": "director",
        "full_name": "Dr. Sailesh Raman",
        "role": "EXPEDITION_DIRECTOR",
        "role_description": "Expedition Planning & Cross-Module Director",
        "station": "43rd ISEA Operations"
    },
    {
        "username": "head.maitri",
        "full_name": "Dr. Tenzing Norbu",
        "role": "STATION_HEAD",
        "role_description": "Maitri Base Station Commander",
        "station": "Maitri Station"
    },
    {
        "username": "logistics",
        "full_name": "Lt. Cdr. Priya Nair",
        "role": "LOGISTICS_OFFICER",
        "role_description": "Cargo, Inventory & Supply Fleet Manager",
        "station": "Maitri Supply Depot"
    },
    {
        "username": "leader",
        "full_name": "Capt. Ananya Iyer",
        "role": "EXPEDITION_LEADER",
        "role_description": "Traverse & Field Expedition Commander",
        "station": "Schirmacher Oasis Field Base"
    },
    {
        "username": "sar",
        "full_name": "Lt. Col. Vikramaditya",
        "role": "SAR_OFFICER",
        "role_description": "Search and Rescue & Emergency Response Lead",
        "station": "Bharati SAR Quick Response Unit"
    },
    {
        "username": "field",
        "full_name": "Dr. Vikram Sethi",
        "role": "FIELD_OPERATOR",
        "role_description": "Field Telemetry & Science Team Operator",
        "station": "Himadri Station (Ny-Ålesund)"
    }
]

@router.post("/login", response_model=schemas.TokenOut)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with username and password.
    Returns signed Bearer token and user profile with role permissions.
    """
    username = request.username.strip().lower()
    user = db.query(models.User).filter(models.User.username == username).first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact the Operations Administrator."
        )

    # Record last login timestamp
    user.last_login = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    db.commit()
    db.refresh(user)

    # Generate JWT Bearer Token
    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
        "assigned_station_id": user.assigned_station_id
    }
    access_token = create_access_token(token_data)

    user_out = schemas.UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        active=user.active,
        station=user.station or "Maitri Station",
        assigned_station_id=user.assigned_station_id,
        assigned_station_name=user.assigned_station.name if user.assigned_station else user.station,
        created_at=user.created_at,
        last_login=user.last_login,
        permissions=get_role_permissions(user.role)
    )

    return schemas.TokenOut(
        access_token=access_token,
        token_type="bearer",
        user=user_out
    )

@router.post("/logout")
def logout():
    """
    Terminates client authentication session.
    """
    return {
        "status": "logged_out",
        "message": "User session successfully terminated."
    }

@router.get("/me", response_model=schemas.UserOut)
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    """
    Get authenticated user's profile and active permissions.
    """
    return schemas.UserOut(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        active=current_user.active,
        station=current_user.station or "Maitri Station",
        assigned_station_id=current_user.assigned_station_id,
        assigned_station_name=current_user.assigned_station.name if current_user.assigned_station else current_user.station,
        created_at=current_user.created_at,
        last_login=current_user.last_login,
        permissions=get_role_permissions(current_user.role)
    )

@router.get("/demo-users", response_model=List[schemas.DemoUserOut])
def get_demo_users():
    """
    Get list of predefined deterministic demo users for development and rapid testing.
    """
    return [schemas.DemoUserOut(**u) for u in DEMO_ACCOUNTS]
