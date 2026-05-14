import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db, SessionLocal
from models import Webhook, Contact

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


class WebhookCreate(BaseModel):
    url: str
    event: str  # contact_created, deal_updated, task_created


class InboundLead(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    origin: Optional[str] = "webhook"


# ── CRUD ────────────────────────────────────────────────────────────────────

@router.get("")
def list_webhooks(db: Session = Depends(get_db)):
    hooks = db.query(Webhook).all()
    return [
        {"id": w.id, "url": w.url, "event": w.event, "active": w.active, "created_at": w.created_at.isoformat()}
        for w in hooks
    ]


@router.post("")
def create_webhook(data: WebhookCreate, db: Session = Depends(get_db)):
    w = Webhook(url=data.url, event=data.event)
    db.add(w)
    db.commit()
    db.refresh(w)
    return {"id": w.id, "url": w.url, "event": w.event, "active": w.active}


@router.delete("/{webhook_id}")
def delete_webhook(webhook_id: int, db: Session = Depends(get_db)):
    w = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not w:
        raise HTTPException(404, "Webhook não encontrado")
    db.delete(w)
    db.commit()
    return {"deleted": True}


# ── Inbound (lead externo → contato) ────────────────────────────────────────

@router.post("/inbound")
def inbound_lead(lead: InboundLead, db: Session = Depends(get_db)):
    existing = None
    if lead.email:
        existing = db.query(Contact).filter(Contact.email == lead.email).first()
    if not existing and lead.phone:
        existing = db.query(Contact).filter(Contact.phone.contains(lead.phone.replace("+", ""))).first()

    if existing:
        return {"created": False, "id": existing.id, "name": existing.name, "message": "Contato já existe"}

    contact = Contact(name=lead.name, email=lead.email, phone=lead.phone)
    db.add(contact)
    db.commit()
    db.refresh(contact)

    # Dispatch webhook
    dispatch_webhook("contact_created", {"id": contact.id, "name": contact.name, "email": contact.email, "phone": contact.phone, "origin": lead.origin})

    return {"created": True, "id": contact.id, "name": contact.name}


# ── Dispatch helper ─────────────────────────────────────────────────────────

def dispatch_webhook(event: str, data: dict):
    """Fire-and-forget webhook dispatch"""
    db = SessionLocal()
    try:
        hooks = db.query(Webhook).filter(Webhook.event == event, Webhook.active == True).all()
    except Exception:
        db.close()
        return
    db.close()

    for w in hooks:
        try:
            with httpx.Client(timeout=5) as client:
                client.post(w.url, json={"event": event, "data": data, "timestamp": datetime.utcnow().isoformat()})
        except Exception:
            pass
