import os
import json
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from database import get_db, SessionLocal
from models import EmailConfig, EmailSent, Activity

router = APIRouter(prefix="/api/email", tags=["Email"])


class SmtpConfig(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    email: str
    password: str
    sender_name: str = "SageCRM"


class SendEmail(BaseModel):
    to: EmailStr
    subject: str
    body: str
    contact_id: Optional[int] = None


@router.post("/config")
def save_config(cfg: SmtpConfig, db: Session = Depends(get_db)):
    existing = db.query(EmailConfig).first()
    if existing:
        existing.smtp_host = cfg.smtp_host
        existing.smtp_port = cfg.smtp_port
        existing.email = cfg.email
        existing.password = cfg.password
        existing.sender_name = cfg.sender_name
    else:
        existing = EmailConfig(
            smtp_host=cfg.smtp_host,
            smtp_port=cfg.smtp_port,
            email=cfg.email,
            password=cfg.password,
            sender_name=cfg.sender_name,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {"saved": True, "id": existing.id}


@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    cfg = db.query(EmailConfig).first()
    if not cfg:
        return {"configured": False}
    return {
        "configured": True,
        "smtp_host": cfg.smtp_host,
        "smtp_port": cfg.smtp_port,
        "email": cfg.email,
        "sender_name": cfg.sender_name,
    }


@router.post("/send")
async def send_email(msg: SendEmail, db: Session = Depends(get_db)):
    cfg = db.query(EmailConfig).first()
    if not cfg:
        raise HTTPException(400, "Email não configurado")

    mime_msg = MIMEMultipart()
    mime_msg["From"] = f"{cfg.sender_name} <{cfg.email}>"
    mime_msg["To"] = msg.to
    mime_msg["Subject"] = msg.subject
    mime_msg.attach(MIMEText(msg.body, "html"))

    try:
        await aiosmtplib.send(
            mime_msg,
            hostname=cfg.smtp_host,
            port=cfg.smtp_port,
            username=cfg.email,
            password=cfg.password,
            start_tls=True,
        )
    except Exception as e:
        raise HTTPException(500, f"Erro ao enviar email: {e}")

    # Log sent email
    sent = EmailSent(to_email=msg.to, subject=msg.subject, body=msg.body, contact_id=msg.contact_id)
    db.add(sent)

    # Create activity if contact linked
    if msg.contact_id:
        activity = Activity(
            type="email",
            title=f"Email: {msg.subject}",
            description=msg.body[:500],
            contact_id=msg.contact_id,
        )
        db.add(activity)

    db.commit()
    return {"sent": True}


@router.get("/sent")
def list_sent(db: Session = Depends(get_db)):
    emails = db.query(EmailSent).order_by(EmailSent.sent_at.desc()).limit(50).all()
    return [
        {
            "id": e.id,
            "to": e.to_email,
            "subject": e.subject,
            "contact_id": e.contact_id,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None,
        }
        for e in emails
    ]


@router.post("/test")
async def test_connection(db: Session = Depends(get_db)):
    cfg = db.query(EmailConfig).first()
    if not cfg:
        raise HTTPException(400, "Email não configurado")

    mime_msg = MIMEMultipart()
    mime_msg["From"] = cfg.email
    mime_msg["To"] = cfg.email
    mime_msg["Subject"] = "SageCRM — Teste de conexão"
    mime_msg.attach(MIMEText("Se você recebeu este email, a configuração SMTP está correta!", "plain"))

    try:
        await aiosmtplib.send(
            mime_msg,
            hostname=cfg.smtp_host,
            port=cfg.smtp_port,
            username=cfg.email,
            password=cfg.password,
            start_tls=True,
        )
        return {"ok": True, "message": "Email de teste enviado com sucesso"}
    except Exception as e:
        raise HTTPException(500, f"Falha na conexão: {e}")
