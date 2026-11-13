import httpx
import logging
from typing import Optional

logger = logging.getLogger("whatsapp_service")

class WhatsAppNotificationService:
    """
    WhatsApp Cloud API / Webhook Integration service.
    
    Adheres to Product Documentation §6.3:
    "Notification delivery depends on external services. A notification failure 
    must not invalidate a ticket or interrupt the underlying queue-processing operation."
    """

    def __init__(self, access_token: Optional[str] = None, phone_number_id: Optional[str] = None):
        self.access_token = access_token
        self.phone_number_id = phone_number_id

    async def send_verification_otp(self, phone: str, otp_code: str) -> bool:
        """Sends a verification OTP code via WhatsApp."""
        message = f"🔐 Your Krenox Verification Code is: {otp_code}\nEnter this code to confirm your phone number for queue notifications."
        return await self._send_text_message(phone, message)

    async def send_ticket_confirmation(self, phone: str, ticket_number: str, service_name: str, position: int, est_wait: int, pin: str) -> bool:
        """Sends initial digital ticket confirmation."""
        message = (
            f"🎟️ *Krenox Virtual Ticket Confirmed*\n\n"
            f"• Ticket: *{ticket_number}*\n"
            f"• Service: *{service_name}*\n"
            f"• Current Position: *#{position}*\n"
            f"• Est. Wait: *~{est_wait} minutes*\n"
            f"• Recovery PIN: *{pin}*\n\n"
            f"We will notify you when only 2 people remain ahead of you!"
        )
        return await self._send_text_message(phone, message)

    async def send_turn_approaching_alert(self, phone: str, ticket_number: str, desk_name: str) -> bool:
        """Alerts the customer when their turn is called or approaching."""
        message = (
            f"📢 *YOUR TURN IS READY! (Ticket {ticket_number})*\n\n"
            f"Please head directly to *{desk_name}* now. Staff member is waiting to serve you."
        )
        return await self._send_text_message(phone, message)

    async def _send_text_message(self, phone: str, message: str) -> bool:
        # Sanitize phone number (strip whitespace and non-digits except '+')
        clean_phone = phone.replace(" ", "").replace("-", "")

        # In dev or when credentials are not configured, simulate delivery with rich terminal logs
        if not self.access_token or not self.phone_number_id:
            logger.info(f"\n[WHATSAPP DISPATCH SIMULATOR] --> Sent to {clean_phone}:\n{message}\n")
            print(f"\n📱 [WHATSAPP DISPATCH to {clean_phone}]:\n{message}\n")
            return True

        # When live credentials are provided (e.g. Meta Cloud API)
        try:
            url = f"https://graph.facebook.com/v19.0/{self.phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_phone,
                "type": "text",
                "text": {"body": message}
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=6.0)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"WhatsApp dispatch failed gracefully: {e}")
            return False

whatsapp_service = WhatsAppNotificationService()
