from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class JoinQueueRequest(BaseModel):
    service_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    reminder_opt_in: bool = True

class TicketResponse(BaseModel):
    id: str
    service_id: str
    ticket_number: str
    pin: str
    customer_name: str
    status: str
    joined_at: datetime
    position: Optional[int] = None
    estimated_wait_minutes: Optional[int] = None

class QueueStatusResponse(BaseModel):
    ticket: TicketResponse
    total_waiting: int
    customers_ahead: int
    open_desks: int

