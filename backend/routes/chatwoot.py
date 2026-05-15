from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import Contact, Deal, Activity
from services.chatwoot import (
    test_connection,
    get_conversations,
    get_conversation as cw_get_conversation,
    get_contact as cw_get_contact,
)

router = APIRouter(prefix="/api/chatwoot", tags=["Chatwoot"])


@router.get("/test")
async def chatwoot_test():
    """Testa conexão com Chatwoot — retorna status e total de conversas."""
    return await test_connection()


@router.get("/conversations")
async def chatwoot_conversations(
    page: int = Query(1, ge=1),
    status: str = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Lista conversas simplificadas do Chatwoot."""
    return await get_conversations(page=page, status=status, limit=limit)


@router.get("/conversations/{conversation_id}")
async def chatwoot_conversation_detail(conversation_id: int):
    """Detalhe completo de uma conversa."""
    return await cw_get_conversation(conversation_id)


@router.post("/sync")
async def chatwoot_sync(db: Session = Depends(get_db)):
    """Sincroniza contatos do Chatwoot com o Sage CRM."""
    page = 1
    synced = 0
    created = 0
    errors = 0

    while True:
        data = await get_conversations(page=page, limit=50)
        conversations = data.get("conversations", []) if isinstance(data, dict) else []
        if not conversations:
            break

        for conv in conversations:
            try:
                contact_name = conv.get("contact_name", "")
                if not contact_name:
                    continue

                cw_conv = await cw_get_conversation(conv["id"])
                meta = cw_conv.get("meta", {})
                sender = meta.get("sender", {})
                cw_email = sender.get("email", "")
                cw_phone = sender.get("phone_number", "")

                existing = None
                if cw_email:
                    existing = db.query(Contact).filter(Contact.email == cw_email).first()
                if not existing and cw_phone:
                    existing = db.query(Contact).filter(Contact.phone == cw_phone).first()

                if existing:
                    if contact_name and existing.name != contact_name:
                        existing.name = contact_name
                    if cw_phone and not existing.phone:
                        existing.phone = cw_phone
                    synced += 1
                else:
                    new_contact = Contact(
                        name=contact_name,
                        email=cw_email or None,
                        phone=cw_phone or None,
                    )
                    db.add(new_contact)
                    created += 1
            except Exception as e:
                print(f"[Chatwoot sync] erro: {e}")
                errors += 1

        page += 1
        if page > 20:
            break

    db.commit()
    return {"synced": synced, "created": created, "errors": errors}


# ── Webhook (público — sem JWT) ─────────────────────────────────────────────

def _find_or_create_contact(db: Session, name: str, email: str = None, phone: str = None):
    """Busca contato por email/telefone ou cria novo."""
    existing = None
    if email:
        existing = db.query(Contact).filter(Contact.email == email).first()
    if not existing and phone:
        existing = db.query(Contact).filter(Contact.phone == phone).first()
    if not existing and name:
        existing = db.query(Contact).filter(Contact.name == name).first()

    if existing:
        if name and existing.name != name:
            existing.name = name
        if phone and not existing.phone:
            existing.phone = phone
        if email and not existing.email:
            existing.email = email
        return existing, False

    contact = Contact(name=name or "Sem nome", email=email or None, phone=phone or None)
    db.add(contact)
    db.flush()
    return contact, True


@router.post("/webhook")
async def chatwoot_webhook(request: Request):
    """Recebe eventos do Chatwoot — sem autenticação JWT."""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ok"}

    event = payload.get("event", "")
    print(f"[Chatwoot Webhook] event={event}")

    db = SessionLocal()
    try:
        if event == "conversation_created":
            _handle_conversation_created(db, payload)
        elif event == "message_created":
            _handle_message_created(db, payload)
        else:
            print(f"[Chatwoot Webhook] evento ignorado: {event}")
    except Exception as e:
        print(f"[Chatwoot Webhook] erro: {e}")
    finally:
        db.close()

    return {"status": "ok"}


def _handle_conversation_created(db: Session, payload: dict):
    """conversation_created → cria Contact + Deal."""
    conversation = payload.get("conversation", {})
    meta = conversation.get("meta", {})
    sender = meta.get("sender", {})

    name = sender.get("name", "")
    email = sender.get("email") or None
    phone = sender.get("phone_number") or None

    if not name:
        print("[Chatwoot Webhook] sem nome no sender, ignorando")
        return

    contact, is_new = _find_or_create_contact(db, name, email, phone)

    if is_new:
        print(f"[Chatwoot Webhook] contato criado: {name} (id={contact.id})")
        # Cria Deal na primeira etapa do pipeline
        deal = Deal(
            title=f"Chatwoot — {name}",
            status="novo",
            stage="prospecção",
            contact_id=contact.id,
        )
        db.add(deal)
        db.flush()
        print(f"[Chatwoot Webhook] deal criado: {deal.title} (id={deal.id})")
    else:
        print(f"[Chatwoot Webhook] contato já existe: {name} (id={contact.id})")

    db.commit()


def _handle_message_created(db: Session, payload: dict):
    """message_created → cria Activity no contato."""
    message = payload.get("message", {})
    conversation = payload.get("conversation", {}) or message.get("conversation", {})

    # Pega sender
    sender = message.get("sender", {}) if message.get("sender") else {}
    if not sender:
        meta = conversation.get("meta", {})
        sender = meta.get("sender", {})

    name = sender.get("name", "")
    email = sender.get("email") or None
    phone = sender.get("phone_number") or None
    content = message.get("content", "")

    if not name:
        return

    contact, _ = _find_or_create_contact(db, name, email, phone)

    # Busca deal mais recente desse contato (pra vincular a activity)
    deal = db.query(Deal).filter(Deal.contact_id == contact.id).order_by(Deal.created_at.desc()).first()

    # Cria activity
    content_preview = (content[:200] + "...") if len(content) > 200 else content
    activity = Activity(
        type="chatwoot_message",
        title=f"Mensagem Chatwoot",
        description=content_preview,
        contact_id=contact.id,
        deal_id=deal.id if deal else None,
    )
    db.add(activity)
    db.commit()
    print(f"[Chatwoot Webhook] activity criada p/ {name}: {content_preview[:50]}...")
