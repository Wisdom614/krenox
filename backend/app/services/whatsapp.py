import httpx
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("whatsapp_service")

class WhatsAppNotificationService:
    """
    WA-AKG Enterprise WhatsApp Gateway Integration.
    Adheres to Baileys formatting and REST API specs:
    POST /api/messages/{sessionId}/{jid}/send
    Header: x-api-key: YOUR_API_KEY
    JID: [CountryCode][Number]@s.whatsapp.net (No '+', dashes or spaces)
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        self.base_url = (base_url or settings.WA_BASE_URL).rstrip("/")
        self.api_key = api_key or settings.WA_API_KEY
        self.session_id = session_id or settings.WA_SESSION_ID

    def _format_jid(self, phone: str) -> str:
        # Strip '+', spaces, dashes, parentheses
        digits = "".join(filter(str.isdigit, phone))
        
        # If user entered local 9-digit Cameroonian number without country code (e.g. 671657357)
        if len(digits) == 9 and digits.startswith("6"):
            digits = f"237{digits}"
        elif len(digits) == 8 and digits.startswith("2"):
            digits = f"237{digits}"

        return f"{digits}@s.whatsapp.net"

    async def send_verification_otp(self, phone: str, otp_code: str) -> bool:
        message = (
            f"🔐 *Krenox Verification Code*\n\n"
            f"Your code is: *{otp_code}*\n\n"
            f"Enter this code on the queue screen to confirm your number for live alerts."
        )
        return await self.send_text(phone, message)

    async def send_ticket_confirmation(
        self,
        phone: str,
        ticket_number: str,
        service_name: str,
        position: int,
        est_wait: int,
        pin: str,
    ) -> bool:
        message = (
            f"🎟️ *Krenox Virtual Ticket Confirmed*\n\n"
            f"• Ticket: *{ticket_number}*\n"
            f"• Service: *{service_name}*\n"
            f"• Live Position: *#{position}*\n"
            f"• Est. Wait: *~{est_wait} minutes*\n"
            f"• Recovery PIN: *{pin}*\n\n"
            f"Keep your phone handy. We will alert you when you are near the front!"
        )
        return await self.send_text(phone, message)

    async def send_turn_approaching_alert(
        self, phone: str, ticket_number: str, desk_name: str
    ) -> bool:
        message = (
            f"📢 *YOUR TURN IS READY! (Ticket {ticket_number})*\n\n"
            f"Please proceed immediately to *{desk_name}* at University of Buea Student Services."
        )
        return await self.send_text(phone, message)

    async def send_text(self, phone: str, text: str) -> bool:
        jid = self._format_jid(phone)
        url = f"{self.base_url}/api/messages/{self.session_id}/{jid}/send"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
        }
        payload = {"message": text}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=8.0)
                if resp.status_code == 200:
                    logger.info(f"WA-AKG message sent successfully to {jid}")
                    return True
                else:
                    logger.error(f"WA-AKG dispatch returned status {resp.status_code}: {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"WA-AKG dispatch error: {e}")
            return False

whatsapp_service = WhatsAppNotificationService()
