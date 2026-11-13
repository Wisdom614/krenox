from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class JoinQueueRequest(BaseModel):
    service_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    reminder_opt_in: bool = True
    notify_threshold: int = Field(default=2, ge=1, le=10, description="Notify when X people remain ahead")

class TicketResponse(BaseModel):
    id: str
    service_id: str
    ticket_number: str
    pin: str
    customer_name: str
    masked_phone: Optional[str] = None
    status: str
    joined_at: datetime
    position: Optional[int] = None
    estimated_wait_minutes: Optional[int] = None
    notify_threshold: int = 2

class QueueStatusResponse(BaseModel):
    ticket: TicketResponse
    total_waiting: int
    customers_ahead: int
    open_desks: int
