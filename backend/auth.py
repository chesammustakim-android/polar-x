import os
import hmac
import hashlib
import secrets
import json
import base64
import time
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas

SECRET_KEY = os.environ.get("POLAR_X_SECRET_KEY", "POLAR_X_SECRET_KEY_NCPOR_ANTARCTICA_SECURE_2026")
ALGORITHM = "HS256"
DEFAULT_TOKEN_EXPIRY_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)

OPERATIONAL_MODULES = [
    "dashboard", "expeditions", "stations", "cargo", "inventory", 
    "personnel", "map", "emergency", "automation", "reports", "settings"
]

# Role Permission Mapping — All operational roles have full view access across operational modules;
# write/modify authority is enforced at the endpoint/action level.
ROLE_PERMISSIONS = {
    "ADMIN": [*OPERATIONAL_MODULES, "admin"],
    "EXPEDITION_DIRECTOR": list(OPERATIONAL_MODULES),
    "STATION_HEAD": list(OPERATIONAL_MODULES),
    "LOGISTICS_OFFICER": list(OPERATIONAL_MODULES),
    "EXPEDITION_LEADER": list(OPERATIONAL_MODULES),
    "SAR_OFFICER": list(OPERATIONAL_MODULES),
    "FIELD_OPERATOR": list(OPERATIONAL_MODULES)
}

def get_role_permissions(role: str) -> List[str]:
    return ROLE_PERMISSIONS.get(role.upper(), list(OPERATIONAL_MODULES))

def hash_password(password: str) -> str:
    """
    Hash password with PBKDF2-HMAC-SHA256 and a random 16-byte salt.
    Format: pbkdf2_sha256$100000$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_hex(16)
    iterations = 100000
    pwd_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    key = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, iterations)
    return f"pbkdf2_sha256${iterations}${salt}${key.hex()}"

def verify_password(plain_password: str, hashed: str) -> bool:
    """
    Verify plain password against PBKDF2-HMAC-SHA256 stored hash.
    """
    if not hashed or not plain_password:
        return False
    try:
        parts = hashed.split('$')
        if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_hash = parts[3]
        
        pwd_bytes = plain_password.encode('utf-8')
        salt_bytes = salt.encode('utf-8')
        computed_key = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, iterations).hex()
        return hmac.compare_digest(computed_key, expected_hash)
    except Exception:
        return False

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ''
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))

def create_access_token(data: dict, expires_hours: int = DEFAULT_TOKEN_EXPIRY_HOURS) -> str:
    """
    Create a signed JWT-compatible token using HMAC-SHA256.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    payload = data.copy()
    now = int(time.time())
    payload["iat"] = now
    payload["exp"] = now + (expires_hours * 3600)

    header_b64 = _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}"

    signature = hmac.new(
        SECRET_KEY.encode('utf-8'),
        signing_input.encode('utf-8'),
        hashlib.sha256
    ).digest()
    signature_b64 = _base64url_encode(signature)

    return f"{signing_input}.{signature_b64}"

def decode_access_token(token: str) -> dict:
    """
    Validate and decode a signed JWT token.
    Raises HTTPException(401) on invalid signature, malformed token, or expiration.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"

        # Verify signature
        expected_sig = hmac.new(
            SECRET_KEY.encode('utf-8'),
            signing_input.encode('utf-8'),
            hashlib.sha256
        ).digest()
        actual_sig = _base64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Parse payload
        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))

        # Check expiration
        exp = payload.get("exp")
        if exp and int(time.time()) > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token could not be verified",
            headers={"WWW-Authenticate": "Bearer"}
        )

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> models.User:
    """
    FastAPI dependency that extracts Bearer token, validates it, and returns active User object.
    """
    token = None
    if auth and auth.credentials:
        token = auth.credentials
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials. Please log in.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated. Contact Station Administrator."
        )

    return user

def require_roles(allowed_roles: List[str]):
    """
    FastAPI dependency factory enforcing that the authenticated user belongs to one of the specified roles.
    """
    def role_checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        user_role = (current_user.role or "").upper()
        allowed = [r.upper() for r in allowed_roles]
        if user_role == "ADMIN":
            return current_user
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}. Your role: {current_user.role}"
            )
        return current_user
    return role_checker

def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if (current_user.role or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required for this operation."
        )
    return current_user
