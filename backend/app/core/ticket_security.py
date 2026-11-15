"""Ticket capability-secret helpers.

Recovery PINs are customer secrets.  Only a salted verifier is persisted; the
plain PIN is returned exactly once when a ticket is issued.
"""
import bcrypt


def hash_ticket_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_ticket_pin(pin: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), encoded.encode("utf-8"))
    except (TypeError, ValueError):
        return False
