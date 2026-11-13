import re
from typing import Optional

def mask_phone_number(phone: Optional[str]) -> str:
    """
    Masks sensitive customer phone number for staff and public displays.
    Example:
    '237671657357' -> '237 671 ••• •57'
    '671657357'    -> '671 ••• •57'
    """
    if not phone:
        return "No phone provided"

    digits = re.sub(r"\D", "", phone)
    if len(digits) < 6:
        return "••••••"

    # Show first 3 digits and last 2 digits, mask the middle with bullet dots
    start = digits[:3]
    end = digits[-2:]
    return f"{start} ••• •{end}"

