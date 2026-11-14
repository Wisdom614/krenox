from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from app.core.supabase import supabase_client

security = HTTPBearer(auto_error=False)

class AuthenticatedUser:
    def __init__(self, user_id: str, email: str, role: str, metadata: dict):
        self.id = user_id
        self.email = email
        self.role = role
        self.metadata = metadata

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials. Please sign in to access this console.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        user_response = supabase_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication session. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = user_response.user
        role = user.user_metadata.get("role", "staff") if user.user_metadata else "staff"
        return AuthenticatedUser(
            user_id=user.id,
            email=user.email or "",
            role=role,
            metadata=user.user_metadata or {}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(allowed_roles: List[str]):
    """
    Factory dependency checking that the authenticated user possesses an authorized role.
    E.g. require_role(["admin"]) or require_role(["staff", "admin"])
    """
    def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}. Your current role is '{user.role}'."
            )
        return user
    return role_checker
