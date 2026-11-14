import re
import random
import uuid
import json
import os
import socket
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from app.core.config import settings
from app.core.supabase import supabase_client
from app.core.masking import mask_phone_number
from app.services.whatsapp import whatsapp_service
from app.services.email import email_service

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
STORE_FILE = os.path.join(DATA_DIR, "organisation_applications.json")
AUDIT_FILE = os.path.join(DATA_DIR, "organisation_audit.json")
VERIF_FILE = os.path.join(DATA_DIR, "organisation_verifications.json")

os.makedirs(DATA_DIR, exist_ok=True)

class OrganisationWorkflowService:
    def __init__(self):
        self._load_local_data()

    @staticmethod
    def get_local_ip() -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def _load_local_data(self):
        if not os.path.exists(STORE_FILE):
            # Seed with University of Buea as default approved tenant
            initial = {
                "4a15875b-bb27-44ef-a6bf-0312f52d0102": {
                    "id": "4a15875b-bb27-44ef-a6bf-0312f52d0102",
                    "registration_ref": "KRN-ORG-00001",
                    "name": "University of Buea",
                    "slug": "ubuea",
                    "category": "Academic",
                    "contact_name": "Registrar Academic Affairs",
                    "contact_channel": "email",
                    "contact_value": "admin@ubuea.cm",
                    "contact_verified": True,
                    "location": "Main Campus, Buea",
                    "status": "APPROVED",
                    "status_reason": "Pre-approved seed institution",
                    "additional_info": "Higher education multi-faculty operations",
                    "created_at": "2026-11-13T19:51:59Z",
                    "reviewed_at": "2026-11-13T19:51:59Z",
                    "reviewed_by": "system_bootstrap",
                    "is_account_setup": True,
                    "admin_email": "admin@ubuea.cm"
                }
            }
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(initial, f, indent=2)

        if not os.path.exists(AUDIT_FILE):
            with open(AUDIT_FILE, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

    def _read_apps(self) -> Dict[str, Dict[str, Any]]:
        try:
            with open(STORE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_apps(self, data: Dict[str, Dict[str, Any]]):
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _read_verifs(self) -> Dict[str, Dict[str, Any]]:
        try:
            if os.path.exists(VERIF_FILE):
                with open(VERIF_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _write_verifs(self, data: Dict[str, Dict[str, Any]]):
        with open(VERIF_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _read_audit(self) -> List[Dict[str, Any]]:
        try:
            with open(AUDIT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _log_audit(self, ref: str, action: str, actor: str, prev_status: Optional[str], new_status: str, reason: Optional[str] = None):
        log_entry = {
            "id": str(uuid.uuid4()),
            "registration_ref": ref,
            "action": action,
            "actor": actor,
            "previous_status": prev_status,
            "new_status": new_status,
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        logs = self._read_audit()
        logs.insert(0, log_entry)
        with open(AUDIT_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2)

    def slugify(self, text: str) -> str:
        slug = re.sub(r"[^\w\s-]", "", text.lower()).strip()
        slug = re.sub(r"[-\s]+", "-", slug)
        return slug or f"org-{random.randint(1000, 9999)}"

    def mask_contact(self, channel: str, val: str) -> str:
        if channel == "email":
            parts = val.split("@")
            if len(parts) == 2:
                name, domain = parts
                visible = name[:2] if len(name) > 2 else name[:1]
                return f"{visible}***@{domain}"
            return val
        else:
            return mask_phone_number(val)

    async def register_organisation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 1: Save application as PENDING_VERIFICATION and dispatch code to contact channel.
        """
        apps = self._read_apps()
        
        # Check duplicate by name
        for item in apps.values():
            if item.get("name", "").strip().lower() == payload["name"].strip().lower():
                if item.get("status") in ["APPROVED", "PENDING_REVIEW"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"An organisation named '{payload['name']}' already exists or has a pending review."
                    )

        ref = f"KRN-ORG-{random.randint(10000, 99999)}"
        org_id = str(uuid.uuid4())
        slug = self.slugify(payload["name"])

        # Generate 6-digit verification code
        code = f"{random.randint(100000, 999999)}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        verifs = self._read_verifs()
        verifs[ref] = {
            "code": code,
            "expires_at": expires_at.isoformat(),
            "attempts": 0,
            "channel": payload["contact_channel"],
            "value": payload["contact_value"]
        }
        self._write_verifs(verifs)

        # Dispatch code
        if payload["contact_channel"] == "whatsapp":
            digits = re.sub(r"\D", "", payload["contact_value"])
            if len(digits) == 9 and digits.startswith("6"):
                digits = f"237{digits}"
            await whatsapp_service.send_verification_otp(digits, code)
        else:
            await email_service.send_verification_otp(payload["contact_value"], code, payload["name"])

        record = {
            "id": org_id,
            "registration_ref": ref,
            "name": payload["name"].strip(),
            "slug": slug,
            "category": payload["category"],
            "contact_name": payload["contact_name"].strip(),
            "contact_channel": payload["contact_channel"],
            "contact_value": payload["contact_value"].strip(),
            "contact_verified": False,
            "location": payload["location"].strip(),
            "status": "PENDING_VERIFICATION",
            "status_reason": None,
            "additional_info": payload.get("additional_info"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewed_by": None,
            "is_account_setup": False,
            "setup_token": None,
            "setup_token_expires_at": None,
            "admin_email": None
        }

        apps[org_id] = record
        self._write_apps(apps)
        self._log_audit(ref, "START_REGISTRATION", payload["contact_name"], None, "PENDING_VERIFICATION")

        return {
            "registration_ref": ref,
            "organisation_name": record["name"],
            "channel": record["contact_channel"],
            "masked_contact": self.mask_contact(record["contact_channel"], record["contact_value"]),
            "status": "PENDING_VERIFICATION",
            "expires_in_minutes": 10,
            "message": f"Verification code dispatched to {self.mask_contact(record['contact_channel'], record['contact_value'])}."
        }

    async def verify_contact(self, ref: str, code: str) -> Dict[str, Any]:
        """
        Step 2: Validate code, mark contact_verified=True, and transition to PENDING_REVIEW.
        """
        verifs = self._read_verifs()
        verif = verifs.get(ref)
        if not verif:
            raise HTTPException(status_code=400, detail="No active verification session found. Please register again.")

        expires_dt = datetime.fromisoformat(verif["expires_at"])
        if datetime.now(timezone.utc) > expires_dt:
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

        verif["attempts"] += 1
        if verif["attempts"] > 5:
            del verifs[ref]
            self._write_verifs(verifs)
            raise HTTPException(status_code=400, detail="Too many invalid attempts. Session terminated for security.")

        if verif["code"] != code.strip():
            self._write_verifs(verifs)
            raise HTTPException(status_code=400, detail="Invalid verification code. Please check and retry.")

        # Successfully verified
        del verifs[ref]
        self._write_verifs(verifs)

        apps = self._read_apps()
        target = None
        for org_id, app in apps.items():
            if app.get("registration_ref") == ref:
                target = app
                break

        if not target:
            raise HTTPException(status_code=404, detail="Application reference not found")

        prev_status = target["status"]
        target["contact_verified"] = True
        target["status"] = "PENDING_REVIEW"
        self._write_apps(apps)

        self._log_audit(ref, "VERIFY_CONTACT", target["contact_name"], prev_status, "PENDING_REVIEW")

        # Send confirmation message to applicant via their chosen channel
        confirmation_msg = (
            f"Krenox: Your organisation '{target['name']}' registration (Ref: {ref}) has been received. "
            f"Our administration team is reviewing it. Expected review window: ~1 hour."
        )
        if target["contact_channel"] == "whatsapp":
            digits = re.sub(r"\D", "", target["contact_value"])
            if len(digits) == 9 and digits.startswith("6"):
                digits = f"237{digits}"
            try:
                await whatsapp_service.send_whatsapp_message(digits, confirmation_msg)
            except Exception:
                pass
        else:
            try:
                await email_service.send_application_submitted(target["contact_value"], target["name"], ref)
            except Exception as e:
                print(f"Notice: Email confirmation dispatch error: {e}")

        return {
            "registration_ref": target["registration_ref"],
            "organisation_name": target["name"],
            "contact_channel": target["contact_channel"],
            "masked_contact": self.mask_contact(target["contact_channel"], target["contact_value"]),
            "status": "PENDING_REVIEW",
            "expected_review_window": "Within 1 hour",
            "headline": "Your organisation registration has been received successfully.",
            "body": "Your contact information has been verified, and your registration has been forwarded to the Krenox administration team for review. We expect to get back to you within 1 hour."
        }

    async def resend_verification_code(self, ref: str) -> Dict[str, Any]:
        """
        Resends a new 6-digit verification code to the registered contact channel
        for an existing registration reference, with progressive cooldown (60s, 120s, 180s...).
        """
        apps = self._read_apps()
        target = None
        for app in apps.values():
            if app.get("registration_ref") == ref:
                target = app
                break

        if not target:
            raise HTTPException(status_code=404, detail="Registration reference not found.")

        if target.get("status") != "PENDING_VERIFICATION":
            raise HTTPException(status_code=400, detail="This application is already verified or reviewed.")

        verifs = self._read_verifs()
        verif = verifs.get(ref, {})

        # Check progressive rate limit (60s, 120s, 180s, etc.)
        resend_count = verif.get("resend_count", 0)
        cooldown_seconds = min(60 * (resend_count + 1), 300)
        last_sent = verif.get("last_sent_at")

        if last_sent:
            try:
                elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(last_sent)).total_seconds()
                if elapsed < cooldown_seconds:
                    remaining = int(cooldown_seconds - elapsed)
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {remaining} seconds before requesting another code."
                    )
            except HTTPException:
                raise
            except Exception:
                pass

        # Generate fresh 6-digit code
        new_code = f"{random.randint(100000, 999999)}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        verifs[ref] = {
            "code": new_code,
            "expires_at": expires_at.isoformat(),
            "attempts": 0,
            "channel": target["contact_channel"],
            "value": target["contact_value"],
            "resend_count": resend_count + 1,
            "last_sent_at": datetime.now(timezone.utc).isoformat()
        }
        self._write_verifs(verifs)

        # Dispatch code
        if target["contact_channel"] == "whatsapp":
            digits = re.sub(r"\D", "", target["contact_value"])
            if len(digits) == 9 and digits.startswith("6"):
                digits = f"237{digits}"
            await whatsapp_service.send_verification_otp(digits, new_code)
        else:
            await email_service.send_verification_otp(target["contact_value"], new_code, target["name"])

        next_cooldown = min(60 * (resend_count + 2), 300)
        return {
            "status": "resent",
            "message": f"A new verification code has been dispatched to {self.mask_contact(target['contact_channel'], target['contact_value'])}.",
            "resend_count": resend_count + 1,
            "cooldown_seconds": next_cooldown
        }

    def get_application_status(self, ref: str) -> Dict[str, Any]:
        apps = self._read_apps()
        for app in apps.values():
            if app.get("registration_ref") == ref:
                return {
                    **app,
                    "masked_contact_value": self.mask_contact(app["contact_channel"], app["contact_value"]),
                    "expected_review_window": "Within 1 hour"
                }
        raise HTTPException(status_code=404, detail=f"No registration found with reference {ref}")

    def list_all_applications(self) -> List[Dict[str, Any]]:
        apps = self._read_apps()
        result = []
        for a in apps.values():
            result.append({
                **a,
                "masked_contact_value": self.mask_contact(a["contact_channel"], a["contact_value"])
            })
        return sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)

    def resubmit_application(self, ref: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Applicant provides additional information requested by the administrator.
        """
        apps = self._read_apps()
        target = None
        for app in apps.values():
            if app.get("registration_ref") == ref:
                target = app
                break

        if not target:
            raise HTTPException(status_code=404, detail="Application reference not found")

        if target["status"] != "ACTION_REQUIRED":
            raise HTTPException(status_code=400, detail="Only applications in ACTION_REQUIRED status can be resubmitted")

        prev_status = target["status"]
        target["status"] = "PENDING_REVIEW"
        target["additional_info"] = payload.get("additional_info") or target.get("additional_info")
        target["status_reason"] = None
        self._write_apps(apps)
        self._log_audit(ref, "RESUBMIT_APPLICATION", target["contact_name"], prev_status, "PENDING_REVIEW", "Applicant provided requested info")

        return {
            "status": "PENDING_REVIEW",
            "message": "Your updated details have been submitted for administrator review."
        }

    async def admin_review_application(self, org_id: str, action: str, actor: str, reason: Optional[str] = None, initial_facility_name: Optional[str] = "Main Facility") -> Dict[str, Any]:
        """
        System Administrator actions: approve, reject, request_info, suspend.
        Generates setup token upon approval so the applicant can configure their account credentials.
        """
        apps = self._read_apps()
        target = apps.get(org_id)
        if not target:
            raise HTTPException(status_code=404, detail="Organisation application not found")

        prev_status = target["status"]
        ref = target["registration_ref"]

        if action == "approve":
            target["status"] = "APPROVED"
            target["status_reason"] = None
            target["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            target["reviewed_by"] = actor

            # Generate single-use setup token for account configuration (72 hours)
            setup_token = f"krn_setup_{secrets.token_urlsafe(20)}"
            setup_token_expires_at = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
            
            # Resolve base frontend URL (prioritise production Vercel frontend)
            base_frontend = (settings.FRONTEND_URL or "https://krenox.vercel.app").rstrip("/")
            if "localhost" in base_frontend and os.getenv("RENDER"):
                base_frontend = "https://krenox.vercel.app"

            setup_url = f"{base_frontend}/setup-account?ref={ref}"
            poster_url = f"{base_frontend}/poster/{target['slug']}"
            queue_url = f"{base_frontend}/q/{target['slug']}"

            target["setup_token"] = setup_token
            target["setup_token_expires_at"] = setup_token_expires_at
            target["setup_url"] = setup_url
            target["poster_url"] = poster_url
            target["is_account_setup"] = False

            # Create or ensure organisation & facility exist in Supabase for live queues
            try:
                supabase_client.table("organisations").upsert({
                    "id": target["id"],
                    "name": target["name"],
                    "slug": target["slug"]
                }).execute()

                supabase_client.table("facilities").upsert({
                    "organisation_id": target["id"],
                    "name": initial_facility_name or f"{target['name']} Main Facility",
                    "location": target.get("location", "Main Office")
                }).execute()
            except Exception as e:
                print(f"Notice: Supabase upsert handled gracefully: {e}")

            self._log_audit(ref, "APPROVE_ORGANISATION", actor, prev_status, "APPROVED", reason or "Meets verification criteria")

            # Notification with Setup Link & Official Poster Link
            if target["contact_channel"] == "whatsapp":
                digits = re.sub(r"\D", "", target["contact_value"])
                if len(digits) == 9 and digits.startswith("6"):
                    digits = f"237{digits}"
                msg = (
                    f"🎉 *Krenox: Organisation Approved!*\n\n"
                    f"Congratulations! *{target['name']}* has been officially APPROVED on the Krenox Virtual Queue network.\n\n"
                    f"📄 *Printable Entrance QR Poster:*\n"
                    f"{poster_url}\n"
                    f"_(Ready to print & mount at your facility entrance!)_\n\n"
                    f"⚙️ *Set Up Admin Credentials:*\n"
                    f"{setup_url}\n\n"
                    f"🎟️ *Public Queue Link:*\n"
                    f"{queue_url}\n\n"
                    f"Welcome to line-free customer service!"
                )
                try:
                    await whatsapp_service.send_whatsapp_message(digits, msg)
                except Exception as e:
                    print(f"Notice: WhatsApp notification error: {e}")
            else:
                try:
                    await email_service.send_approval_with_setup_token(
                        target["contact_value"],
                        target["name"],
                        ref,
                        setup_url,
                        setup_token,
                        poster_url=poster_url,
                        portal_url=f"{base_frontend}/login"
                    )
                except Exception as e:
                    print(f"Notice: Email notification error: {e}")

        elif action == "reject":
            if not reason or len(reason.strip()) < 5:
                raise HTTPException(status_code=400, detail="A mandatory rejection reason is required")
            target["status"] = "REJECTED"
            target["status_reason"] = reason.strip()
            target["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            target["reviewed_by"] = actor
            self._log_audit(ref, "REJECT_ORGANISATION", actor, prev_status, "REJECTED", reason.strip())

            # Notify applicant
            rejection_text = f"Krenox: Your organisation registration for '{target['name']}' was not approved. Reason: {reason}"
            if target["contact_channel"] == "whatsapp":
                digits = re.sub(r"\D", "", target["contact_value"])
                try:
                    await whatsapp_service.send_whatsapp_message(digits, rejection_text)
                except Exception:
                    pass
            else:
                try:
                    await email_service.send_status_update_notification(
                        target["contact_value"], target["name"], ref, "REJECTED", reason
                    )
                except Exception:
                    pass

        elif action == "request_info":
            if not reason or len(reason.strip()) < 5:
                raise HTTPException(status_code=400, detail="A detailed description of the required information is required")
            target["status"] = "ACTION_REQUIRED"
            target["status_reason"] = reason.strip()
            target["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            target["reviewed_by"] = actor
            self._log_audit(ref, "REQUEST_ADDITIONAL_INFO", actor, prev_status, "ACTION_REQUIRED", reason.strip())

            info_text = f"Krenox: Additional information is needed for your organisation '{target['name']}'. Details: {reason}"
            if target["contact_channel"] == "whatsapp":
                digits = re.sub(r"\D", "", target["contact_value"])
                try:
                    await whatsapp_service.send_whatsapp_message(digits, info_text)
                except Exception:
                    pass
            else:
                try:
                    await email_service.send_status_update_notification(
                        target["contact_value"], target["name"], ref, "ACTION_REQUIRED", reason
                    )
                except Exception:
                    pass

        elif action == "suspend":
            if not reason or len(reason.strip()) < 5:
                raise HTTPException(status_code=400, detail="A mandatory reason for suspension is required")
            target["status"] = "SUSPENDED"
            target["status_reason"] = reason.strip()
            target["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            target["reviewed_by"] = actor
            self._log_audit(ref, "SUSPEND_ORGANISATION", actor, prev_status, "SUSPENDED", reason.strip())

            susp_text = f"Krenox: Operational access for organisation '{target['name']}' has been suspended. Reason: {reason}"
            if target["contact_channel"] == "whatsapp":
                digits = re.sub(r"\D", "", target["contact_value"])
                try:
                    await whatsapp_service.send_whatsapp_message(digits, susp_text)
                except Exception:
                    pass
            else:
                try:
                    await email_service.send_status_update_notification(
                        target["contact_value"], target["name"], ref, "SUSPENDED", reason
                    )
                except Exception:
                    pass

        self._write_apps(apps)

        return {
            "status": "ok",
            "action": action,
            "new_status": target["status"],
            "setup_token": target.get("setup_token"),
            "setup_url": target.get("setup_url"),
            "organisation": target
        }

    def get_setup_info(self, token: str) -> Dict[str, Any]:
        """
        Validates account setup token (or registration_ref) and returns tenant configuration preview.
        """
        if not token or len(token.strip()) < 5:
            raise HTTPException(status_code=400, detail="Invalid account setup link or reference.")

        apps = self._read_apps()
        target = None
        for app in apps.values():
            if app.get("setup_token") == token.strip() or app.get("registration_ref") == token.strip():
                target = app
                break

        if not target:
            raise HTTPException(status_code=404, detail="Setup link is invalid or has already been used.")

        if target.get("is_account_setup", False):
            raise HTTPException(status_code=400, detail="This organisation account has already been set up. Please log in directly.")

        expires_at = target.get("setup_token_expires_at")
        if expires_at and datetime.now(timezone.utc) > datetime.fromisoformat(expires_at):
            raise HTTPException(status_code=400, detail="This setup link has expired. Please contact the administrator for a new link.")

        return {
            "organisation_id": target["id"],
            "organisation_name": target["name"],
            "registration_ref": target["registration_ref"],
            "category": target["category"],
            "location": target["location"],
            "contact_name": target["contact_name"],
            "contact_channel": target["contact_channel"],
            "suggested_email": target["contact_value"] if target["contact_channel"] == "email" else "",
            "masked_contact": self.mask_contact(target["contact_channel"], target["contact_value"])
        }

    async def complete_account_setup(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates tenant administrator user in Supabase auth and marks account as configured.
        """
        token = payload.get("token", "").strip()
        email = payload.get("email", "").strip().lower()
        password = payload.get("password", "")

        if not token:
            raise HTTPException(status_code=400, detail="Setup token is required.")

        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="A valid administrator email address is required.")

        if not password or len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

        apps = self._read_apps()
        target = None
        for app in apps.values():
            if app.get("setup_token") == token or app.get("registration_ref") == token:
                target = app
                break

        if not target:
            raise HTTPException(status_code=404, detail="Setup token is invalid or has expired.")

        if target.get("is_account_setup", False):
            raise HTTPException(status_code=400, detail="Account setup has already been completed.")

        # Create or update user in Supabase Auth
        try:
            supabase_client.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "role": "admin",
                    "organisation_id": target["id"],
                    "organisation_name": target["name"],
                    "contact_name": target["contact_name"]
                }
            })
            print(f"✅ Supabase user created for {email} (Organisation: {target['name']})")
        except Exception as e:
            err_str = str(e)
            print(f"Notice: Supabase create user note: {err_str}")
            # If user already exists, update their metadata and password
            try:
                users_res = supabase_client.auth.admin.list_users()
                existing_user = next((u for u in users_res if getattr(u, "email", "").lower() == email), None)
                if existing_user:
                    supabase_client.auth.admin.update_user_by_id(existing_user.id, {
                        "password": password,
                        "user_metadata": {
                            "role": "admin",
                            "organisation_id": target["id"],
                            "organisation_name": target["name"],
                            "contact_name": target["contact_name"]
                        }
                    })
                    print(f"✅ Updated existing Supabase user credentials for {email}")
            except Exception as inner_e:
                print(f"Notice: Supabase update attempt: {inner_e}")

        # Invalidate one-time token and mark as setup
        target["is_account_setup"] = True
        target["setup_token"] = None
        target["admin_email"] = email
        target["account_setup_at"] = datetime.now(timezone.utc).isoformat()
        self._write_apps(apps)

        self._log_audit(
            target["registration_ref"],
            "COMPLETE_ACCOUNT_SETUP",
            target["contact_name"],
            "APPROVED",
            "APPROVED",
            f"Account credentials configured with email: {email}"
        )

        return {
            "status": "ok",
            "message": "Administrator account successfully configured. You may now sign in.",
            "organisation_name": target["name"],
            "admin_email": email
        }

    def regenerate_setup_token(self, org_id: str, actor: str) -> Dict[str, Any]:
        """
        Regenerates a fresh setup token for an approved organisation if needed.
        """
        apps = self._read_apps()
        target = apps.get(org_id)
        if not target:
            raise HTTPException(status_code=404, detail="Organisation not found.")

        if target.get("status") != "APPROVED":
            raise HTTPException(status_code=400, detail="Setup tokens can only be generated for approved organisations.")

        ref = target["registration_ref"]
        setup_token = f"krn_setup_{secrets.token_urlsafe(20)}"
        setup_token_expires_at = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        setup_url = f"{settings.FRONTEND_URL}/setup-account?token={setup_token}&ref={ref}"

        target["setup_token"] = setup_token
        target["setup_token_expires_at"] = setup_token_expires_at
        target["setup_url"] = setup_url
        self._write_apps(apps)

        self._log_audit(ref, "REGENERATE_SETUP_TOKEN", actor, "APPROVED", "APPROVED", "Administrator requested new setup token")

        return {
            "status": "ok",
            "setup_token": setup_token,
            "setup_url": setup_url,
            "expires_at": setup_token_expires_at
        }

    def get_audit_trail(self, ref: Optional[str] = None) -> List[Dict[str, Any]]:
        logs = self._read_audit()
        if ref:
            return [l for l in logs if l.get("registration_ref") == ref]
        return logs

    def is_organisation_approved(self, org_id: Optional[str] = None, slug: Optional[str] = None) -> bool:
        """
        CRITICAL ACCESS CONTROL GATE:
        Returns True ONLY if organisation exists and has status == 'APPROVED'.
        """
        apps = self._read_apps()
        if org_id and org_id in apps:
            return apps[org_id].get("status") == "APPROVED"
        if slug:
            for item in apps.values():
                if item.get("slug") == slug:
                    return item.get("status") == "APPROVED"
        return False

    def get_public_directory(self) -> List[Dict[str, Any]]:
        """
        Public directory of approved organisations for customer search and selection.
        """
        apps = self._read_apps()
        directory = []
        for app in apps.values():
            if app.get("status") == "APPROVED":
                directory.append({
                    "id": app["id"],
                    "name": app["name"],
                    "slug": app.get("slug") or app["id"],
                    "category": app.get("category", "General"),
                    "location": app.get("location", "")
                })
        if not directory:
            res = supabase_client.table("organisations").select("id, name, slug").execute()
            for row in res.data or []:
                directory.append({
                    "id": row["id"],
                    "name": row["name"],
                    "slug": row.get("slug") or row["id"],
                    "category": "Organisation",
                    "location": ""
                })
        return directory

    def get_public_tenant_queues(self, slug_or_id: str) -> Dict[str, Any]:
        """
        Fetches an approved organisation's public facilities, services, and live queue status.
        """
        apps = self._read_apps()
        target_app = None
        for app in apps.values():
            if app.get("slug") == slug_or_id or app.get("id") == slug_or_id:
                target_app = app
                break

        org_id = target_app["id"] if target_app else None
        org_name = target_app["name"] if target_app else None
        org_slug = target_app.get("slug", slug_or_id) if target_app else slug_or_id
        org_category = target_app.get("category", "General") if target_app else "General"
        org_location = target_app.get("location", "") if target_app else ""

        # If not found in local apps, check Supabase organisations
        if not org_id:
            import uuid
            is_uuid = False
            try:
                uuid.UUID(str(slug_or_id))
                is_uuid = True
            except (ValueError, TypeError):
                is_uuid = False

            query = supabase_client.table("organisations").select("*")
            if is_uuid:
                s_res = query.or_(f"slug.eq.{slug_or_id},id.eq.{slug_or_id}").limit(1).execute()
            else:
                s_res = query.eq("slug", slug_or_id).limit(1).execute()

            if s_res.data:
                o = s_res.data[0]
                org_id = o["id"]
                org_name = o["name"]
                org_slug = o.get("slug") or org_id

        if not org_id:
            raise HTTPException(status_code=404, detail="Organisation not found")

        # Access check
        if target_app and target_app.get("status") != "APPROVED":
            raise HTTPException(
                status_code=403,
                detail="This organisation's registration is currently pending review or suspended."
            )

        # Fetch facilities and services
        fac_res = (
            supabase_client.table("facilities")
            .select("id, name, location, services(*)")
            .eq("organisation_id", org_id)
            .execute()
        )
        facilities_data = []
        for fac in fac_res.data or []:
            fac_services = []
            for svc in fac.get("services") or []:
                if not svc.get("is_active", True):
                    continue

                # Count waiting tickets
                w_count = (
                    supabase_client.table("tickets")
                    .select("id", count="exact")
                    .eq("service_id", svc["id"])
                    .eq("status", "waiting")
                    .execute()
                )
                waiting = w_count.count or 0

                # Count open desks for this facility
                desk_count = (
                    supabase_client.table("service_desks")
                    .select("id", count="exact")
                    .eq("facility_id", fac["id"])
                    .eq("is_open", True)
                    .execute()
                )
                open_desks = max(desk_count.count or 1, 1)

                avg_dur = svc.get("avg_duration_minutes", 15)
                est_wait = max((waiting * avg_dur) // open_desks, 2) if waiting > 0 else 0

                fac_services.append({
                    "id": svc["id"],
                    "facility_id": fac["id"],
                    "name": svc["name"],
                    "prefix": svc.get("prefix", "Q"),
                    "avg_duration_minutes": avg_dur,
                    "waiting_count": waiting,
                    "open_desks": open_desks,
                    "est_wait_minutes": est_wait
                })

            facilities_data.append({
                "id": fac["id"],
                "name": fac["name"],
                "location": fac.get("location", ""),
                "services": fac_services
            })

        return {
            "organisation": {
                "id": org_id,
                "name": org_name,
                "slug": org_slug,
                "category": org_category,
                "location": org_location
            },
            "facilities": facilities_data
        }

    # ── Tenant Dedicated Operations ──

    def get_tenant_dashboard(self, org_id: str) -> Dict[str, Any]:
        """
        Returns full operational telemetry scoped strictly to a specific organisation.
        """
        apps = self._read_apps()
        org_app = apps.get(org_id)

        # Check Supabase organisations
        org_res = supabase_client.table("organisations").select("*").eq("id", org_id).single().execute()
        if not org_res.data and not org_app:
            raise HTTPException(status_code=404, detail="Organisation not found")

        org_name = org_res.data.get("name") if org_res.data else org_app.get("name", "Organisation")
        org_slug = org_res.data.get("slug") if org_res.data else org_app.get("slug", "")
        org_loc = org_app.get("location", "") if org_app else ""
        org_cat = org_app.get("category", "General") if org_app else "General"
        org_status = org_app.get("status", "APPROVED") if org_app else "APPROVED"

        # 1. Facilities
        fac_res = (
            supabase_client.table("facilities")
            .select("*")
            .eq("organisation_id", org_id)
            .order("created_at", desc=False)
            .execute()
        )
        facilities = fac_res.data or []
        facility_ids = [f["id"] for f in facilities]

        # 2. Services
        services = []
        desks = []
        tickets = []
        if facility_ids:
            svc_res = (
                supabase_client.table("services")
                .select("*")
                .in_("facility_id", facility_ids)
                .order("name", desc=False)
                .execute()
            )
            services = svc_res.data or []

            desk_res = (
                supabase_client.table("service_desks")
                .select("*")
                .in_("facility_id", facility_ids)
                .order("name", desc=False)
                .execute()
            )
            desks = desk_res.data or []

            service_ids = [s["id"] for s in services]
            if service_ids:
                t_res = (
                    supabase_client.table("tickets")
                    .select("id, status, joined_at, service_id")
                    .in_("service_id", service_ids)
                    .execute()
                )
                tickets = t_res.data or []

        # Calculate metrics
        waiting_count = sum(1 for t in tickets if t["status"] == "waiting")
        serving_count = sum(1 for t in tickets if t["status"] in ["called", "serving"])
        completed_count = sum(1 for t in tickets if t["status"] == "completed")
        absent_count = sum(1 for t in tickets if t["status"] in ["absent", "skipped"])

        # 3. Staff members
        staff_members = self.list_tenant_staff(org_id)

        return {
            "organisation": {
                "id": org_id,
                "name": org_name,
                "slug": org_slug,
                "category": org_cat,
                "location": org_loc,
                "status": org_status,
                "public_url": f"/q/{org_slug}",
            },
            "local_ip": self.get_local_ip(),
            "facilities": facilities,
            "services": services,
            "desks": desks,
            "staff": staff_members,
            "metrics": {
                "total_tickets": len(tickets),
                "waiting": waiting_count,
                "serving": serving_count,
                "completed": completed_count,
                "absent_or_skipped": absent_count,
                "open_desks": sum(1 for d in desks if d.get("is_open", False)),
                "total_desks": len(desks),
            },
        }

    def create_tenant_facility(self, org_id: str, name: str, location: Optional[str] = None) -> Dict[str, Any]:
        """Creates a new facility / campus / branch for the organisation."""
        insert_res = (
            supabase_client.table("facilities")
            .insert({
                "organisation_id": org_id,
                "name": name.strip(),
                "location": (location or "").strip() or None,
            })
            .execute()
        )
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create facility")
        
        created_fac = insert_res.data[0]

        # Provision initial counter desk for the new facility
        supabase_client.table("service_desks").insert({
            "facility_id": created_fac["id"],
            "name": "Counter 1",
            "is_open": True,
        }).execute()

        return created_fac

    def create_tenant_service(
        self,
        org_id: str,
        facility_id: str,
        name: str,
        prefix: str,
        avg_duration_minutes: int
    ) -> Dict[str, Any]:
        """Creates a new service line under an organisation's facility."""
        # Verify facility belongs to this organisation
        fac = (
            supabase_client.table("facilities")
            .select("id, organisation_id")
            .eq("id", facility_id)
            .single()
            .execute()
        )
        if not fac.data or fac.data["organisation_id"] != org_id:
            raise HTTPException(status_code=403, detail="Facility does not belong to this organisation")

        insert_res = (
            supabase_client.table("services")
            .insert({
                "facility_id": facility_id,
                "name": name.strip(),
                "prefix": prefix.strip().upper(),
                "avg_duration_minutes": avg_duration_minutes,
                "is_active": True,
            })
            .execute()
        )
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create service")
        return insert_res.data[0]

    def create_tenant_desk(self, org_id: str, facility_id: str, name: str) -> Dict[str, Any]:
        """Creates a new service counter under an organisation's facility."""
        fac = (
            supabase_client.table("facilities")
            .select("id, organisation_id")
            .eq("id", facility_id)
            .single()
            .execute()
        )
        if not fac.data or fac.data["organisation_id"] != org_id:
            raise HTTPException(status_code=403, detail="Facility does not belong to this organisation")

        insert_res = (
            supabase_client.table("service_desks")
            .insert({
                "facility_id": facility_id,
                "name": name.strip(),
                "is_open": True,
            })
            .execute()
        )
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create desk")
        return insert_res.data[0]

    def list_tenant_staff(self, org_id: str) -> List[Dict[str, Any]]:
        """Lists all staff accounts associated with this organisation."""
        try:
            users_res = supabase_client.auth.admin.list_users()
            all_users = users_res if isinstance(users_res, list) else getattr(users_res, "users", [])
            org_staff = []
            for u in all_users:
                meta = getattr(u, "user_metadata", {}) or {}
                if meta.get("organisation_id") == org_id:
                    org_staff.append({
                        "id": getattr(u, "id", ""),
                        "email": getattr(u, "email", ""),
                        "name": meta.get("name") or meta.get("contact_name") or "Staff Operator",
                        "role": meta.get("role", "staff"),
                        "created_at": str(getattr(u, "created_at", "")),
                    })
            return org_staff
        except Exception as e:
            print(f"Notice: Supabase list_users: {e}")
            return []

    def create_tenant_staff(self, org_id: str, name: str, email: str, password: str) -> Dict[str, Any]:
        """Provisions a new staff user account for this organisation."""
        apps = self._read_apps()
        org_app = apps.get(org_id)
        org_name = org_app.get("name", "Organisation") if org_app else "Organisation"

        try:
            user = supabase_client.auth.admin.create_user({
                "email": email.strip().lower(),
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "role": "staff",
                    "organisation_id": org_id,
                    "organisation_name": org_name,
                    "name": name.strip(),
                },
            })
            return {
                "id": getattr(user.user, "id", str(uuid.uuid4())),
                "email": email.strip().lower(),
                "name": name.strip(),
                "role": "staff",
                "organisation_id": org_id,
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to create staff account: {str(e)}")

    def update_tenant_profile(
        self,
        org_id: str,
        name: Optional[str] = None,
        location: Optional[str] = None,
        additional_info: Optional[str] = None
    ) -> Dict[str, Any]:
        """Updates organisation profile settings."""
        apps = self._read_apps()
        if org_id in apps:
            if name:
                apps[org_id]["name"] = name.strip()
            if location:
                apps[org_id]["location"] = location.strip()
            if additional_info is not None:
                apps[org_id]["additional_info"] = additional_info.strip()
            self._write_apps(apps)

        update_data = {}
        if name:
            update_data["name"] = name.strip()
        if update_data:
            supabase_client.table("organisations").update(update_data).eq("id", org_id).execute()

        return {"status": "ok", "message": "Organisation profile updated successfully"}


org_workflow_service = OrganisationWorkflowService()
