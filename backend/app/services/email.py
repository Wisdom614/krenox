import os
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

class EmailService:
    def __init__(self):
        self.api_key = settings.RESEND_API_KEY or os.getenv("RESEND_API_KEY", "")
        self.from_email = settings.RESEND_FROM_EMAIL or os.getenv("RESEND_FROM_EMAIL", "Krenox <verify@wisedev.online>")

    def _reload_config(self):
        self.api_key = os.getenv("RESEND_API_KEY") or settings.RESEND_API_KEY or ""
        self.from_email = os.getenv("RESEND_FROM_EMAIL") or settings.RESEND_FROM_EMAIL or "Krenox <verify@wisedev.online>"

    async def send_email(self, to: str, subject: str, html: str) -> Dict[str, Any]:
        """
        Sends an email using Resend REST API if RESEND_API_KEY is present,
        otherwise logs to console for local simulation.
        """
        self._reload_config()

        if not self.api_key:
            print(f"📧 [Email Simulated (No RESEND_API_KEY)] To: {to} | Subject: {subject}")
            print(f"--------------------------------------------------\n{html}\n--------------------------------------------------")
            return {"status": "simulated", "message": "Email logged to console. Add RESEND_API_KEY to .env to enable real delivery."}

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": self.from_email,
            "to": [to],
            "subject": subject,
            "html": html
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in [200, 201]:
                    data = res.json()
                    print(f"✅ [Resend] Email sent to {to} (ID: {data.get('id')})")
                    return {"status": "sent", "id": data.get("id")}
                else:
                    err_msg = res.text
                    print(f"❌ [Resend Error] {res.status_code}: {err_msg}")
                    return {"status": "error", "detail": err_msg}
        except Exception as e:
            print(f"❌ [Resend Exception] {str(e)}")
            return {"status": "failed", "detail": str(e)}

    async def send_verification_otp(self, to: str, code: str, org_name: str) -> Dict[str, Any]:
        subject = f"Your Krenox Verification Code: {code}"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Krenox · Virtual Queue Operations</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Enterprise Tenant Onboarding</p>
          </div>
          
          <p style="color: #334155; font-size: 15px; line-height: 1.5; margin-bottom: 20px;">
            Hello from Krenox,
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
            We received a request to register <strong>{org_name}</strong> on the Krenox Virtual Queue Platform.
            Please use the 6-digit verification code below to verify your email address:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #059669; font-family: monospace;">
              {code}
            </div>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">This code expires in 10 minutes.</p>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
            If you did not initiate this registration, you can safely ignore this email.
          </p>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© 2026 Krenox Platform. All rights reserved.</p>
          </div>
        </div>
        """
        return await self.send_email(to, subject, html)

    async def send_application_submitted(self, to: str, org_name: str, ref: str) -> Dict[str, Any]:
        subject = f"Registration Received: {org_name} ({ref})"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">Krenox Platform</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Registration Submission Notice</p>
          </div>
          
          <h3 style="color: #0f172a; font-size: 17px; margin-top: 0; margin-bottom: 12px;">Your organisation registration has been received successfully.</h3>
          
          <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Your contact information has been verified, and your registration has been forwarded to the Krenox administration team for review. <strong>We expect to get back to you within 1 hour.</strong>
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Registration Reference:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0f172a; text-align: right; font-family: monospace;">{ref}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Organisation:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0f172a; text-align: right;">{org_name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Current Status:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #d97706; text-align: right;">PENDING_REVIEW</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Target Review Response:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #059669; text-align: right;">Within 1 hour</td>
              </tr>
            </table>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© 2026 Krenox Platform. All rights reserved.</p>
          </div>
        </div>
        """
        return await self.send_email(to, subject, html)

    async def send_approval_with_setup_token(self, to: str, org_name: str, ref: str, setup_url: str, setup_token: str) -> Dict[str, Any]:
        subject = f"Registration Approved: Set Up Your Account for {org_name}"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">Krenox Platform</h2>
            <p style="margin: 4px 0 0 0; color: #059669; font-size: 13px; font-weight: 600;">✓ Registration Approved & Activated</p>
          </div>
          
          <h3 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 12px;">
            Congratulations! Your organisation has been approved.
          </h3>
          
          <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Your registration for <strong>{org_name}</strong> (Ref: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace;">{ref}</code>) has passed administrative review. 
            You can now create your administrator password and start configuring service desks and queue counters.
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="{setup_url}" style="background-color: #059669; color: #ffffff; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 12px rgba(5,150,105,0.25);">
              Set Up Administrator Account →
            </a>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 12px; color: #64748b;">
            <p style="margin: 0 0 8px 0;"><strong>One-Time Setup Token:</strong></p>
            <div style="font-family: monospace; font-size: 13px; color: #0f172a; background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; word-break: break-all;">
              {setup_token}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 11px;">
              Direct Link: <a href="{setup_url}" style="color: #059669; word-break: break-all;">{setup_url}</a>
            </p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
              This setup link is single-use and will expire in 72 hours.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #334155; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
              <strong>Staff & Admin Portal Login:</strong> Bookmark <a href="http://localhost:3000/login" style="color: #059669; font-weight: 600;">http://localhost:3000/login</a> for daily counter operations.
            </p>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© 2026 Krenox Platform. All rights reserved.</p>
          </div>
        </div>
        """
        return await self.send_email(to, subject, html)

    async def send_status_update_notification(self, to: str, org_name: str, ref: str, status: str, reason: Optional[str] = None) -> Dict[str, Any]:
        subject = f"Application Update: {org_name} is now {status}"
        color_map = {
            "APPROVED": "#059669",
            "REJECTED": "#dc2626",
            "ACTION_REQUIRED": "#d97706",
            "SUSPENDED": "#dc2626"
        }
        status_color = color_map.get(status, "#0f172a")

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">Krenox Platform</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Administrative Review Decision</p>
          </div>
          
          <p style="color: #334155; font-size: 15px; line-height: 1.5; margin-bottom: 16px;">
            The review for <strong>{org_name}</strong> (Ref: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">{ref}</code>) has been updated:
          </p>

          <div style="background-color: #f8fafc; border-left: 4px solid {status_color}; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
            <div style="font-size: 16px; font-weight: 700; color: {status_color};">Status: {status}</div>
            {f'<p style="margin: 8px 0 0 0; color: #475569; font-size: 14px;"><strong>Note:</strong> {reason}</p>' if reason else ''}
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© 2026 Krenox Platform. All rights reserved.</p>
          </div>
        </div>
        """
        return await self.send_email(to, subject, html)

email_service = EmailService()
