from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.simulation.engine import run_queue_simulation

router = APIRouter(prefix="/simulation", tags=["simulation"])

class SimulationParamsPayload(BaseModel):
    num_customers: int = Field(default=80, ge=10, le=500, description="Total customers simulated")
    arrival_interval_mins: float = Field(default=2.5, ge=0.5, le=30.0, description="Average time between arrivals")
    service_duration_mins: float = Field(default=8.0, ge=1.0, le=60.0, description="Average counter handling time")
    num_counters: int = Field(default=3, ge=1, le=20, description="Number of open service desks")
    transit_time_mins: float = Field(default=3.0, ge=1.0, le=15.0, description="Walking transit buffer")
    random_seed: int = Field(default=42, description="Random seed for scientific reproducibility")

@router.post("/run")
def execute_simulation(payload: SimulationParamsPayload):
    """
    Executes controlled SimPy discrete-event simulation comparing
    Conventional Physical Queue vs. Krenox Virtual Queue.
    """
    results = run_queue_simulation(
        num_customers=payload.num_customers,
        arrival_interval_mins=payload.arrival_interval_mins,
        service_duration_mins=payload.service_duration_mins,
        num_counters=payload.num_counters,
        transit_time_mins=payload.transit_time_mins,
        random_seed=payload.random_seed,
    )
    return results
