from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.security import limiter
from app.api import queues, staff, simulation

app = FastAPI(
    title="Krenox API",
    description="Virtual Queue Management Platform & Discrete Event Simulation API",
    version="0.1.0"
)

# Connect SlowAPI Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(queues.router)
app.include_router(staff.router)
app.include_router(simulation.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "krenox-backend", "version": "0.1.0"}
