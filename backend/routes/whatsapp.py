import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from database import get_db, SessionLocal
from models import Activity, Contact

load_dotenv()

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

EVO_URL = os.getenv("EVOLUTION_API_URL", "").rstrip("/")
EVO_KEY = os.getenv("EVOLUTION_API_KEY", "")
INSTANCE = "sagecrm"


class SendMsg(BaseModel):
    number: str
    text: str


def _check_config():
    return bool(EVO_URL and EVO_KEY)


def evo_headers():
    if not _check_config():
        raise HTTPException(400, "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env primeiro")
    return {"apikey": EVO_KEY, "Content-Type": "application/json"}


@router.post("/connect")
def connect():
    """Cria instância e retorna QR code para escanear"""
    if not _check_config():
        raise HTTPException(400, "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env primeiro")
    headers = evo_headers()
    with httpx.Client(timeout=15) as client:
        # Try to create instance
        try:
            client.post(
                f"{EVO_URL}/instance/create",
                headers=headers,
                json={"instanceName": INSTANCE, "qrcode": True, "integration": "WHATSAPP-BAILEYS"},
            )
        except Exception:
            pass

        # Connect / get QR
        try:
            resp = client.post(
                f"{EVO_URL}/instance/connect/{INSTANCE}",
                headers=headers,
            )
            data = resp.json()
        except Exception as e:
            raise HTTPException(500, f"Erro ao conectar com Evolution API: {e}")

    if data.get("code") and data["code"] == 404:
        raise HTTPException(404, "Instância não encontrada na Evolution API")

    base64 = data.get("base64", {})
    qrcode = base64.get("image") if isinstance(base64, dict) else None

    # Some versions return directly
    if not qrcode and isinstance(data, dict):
        qrcode = data.get("qrcode", {}).get("code") if isinstance(data.get("qrcode"), dict) else None

    return {"status": data.get("state", "unknown"), "qrcode": qrcode}


@router.get("/status")
def status():
    """Verifica status de conexão"""
    if not _check_config():
        return {"connected": False, "configured": False, "status": "not_configured", "message": "Evolution API não configurada"}
    headers = evo_headers()
    with httpx.Client(timeout=10) as client:
        try:
            resp = client.get(f"{EVO_URL}/instance/connectionState/{INSTANCE}", headers=headers)
            data = resp.json()
            return {"status": data.get("state", data.get("status", "unknown"))}
        except Exception as e:
            return {"status": "error", "detail": str(e)}


@router.post("/send")
def send_message(msg: SendMsg):
    """Envia mensagem de texto"""
    if not _check_config():
        raise HTTPException(400, "WhatsApp não configurado")
    headers = evo_headers()
    number = msg.number.replace("+", "").replace(" ", "").replace("-", "")
    with httpx.Client(timeout=15) as client:
        try:
            resp = client.post(
                f"{EVO_URL}/message/sendText/{INSTANCE}",
                headers=headers,
                json={"number": number, "text": msg.text, "delay": 500},
            )
            return {"sent": True, "data": resp.json()}
        except Exception as e:
            raise HTTPException(500, f"Erro ao enviar: {e}")


@router.post("/webhook")
def webhook(payload: dict):
    """Recebe mensagens do WhatsApp via webhook da Evolution API"""
    data = payload.get("data", payload)
    if not data:
        return {"ok": True}

    # Extract message info
    key = data.get("key", {})
    from_number = key.get("remoteJid", "").replace("@s.whatsapp.net", "")
    message = data.get("message", {})
    text = message.get("conversation", "") or message.get("extendedTextMessage", {}).get("text", "")

    if not text or key.get("fromMe"):
        return {"ok": True}

    # Find contact by phone
    db = SessionLocal()
    try:
        phone_clean = from_number.replace("+", "").replace(" ", "")
        contact = db.query(Contact).filter(Contact.phone.contains(phone_clean[-8:])).first()

        activity = Activity(
            type="whatsapp",
            title=f"WhatsApp de {from_number}",
            description=text,
            contact_id=contact.id if contact else None,
        )
        db.add(activity)
        db.commit()
    except Exception as e:
        print(f"Webhook error: {e}")
    finally:
        db.close()

    return {"ok": True}
