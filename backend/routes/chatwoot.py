from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Contact
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

                # Pega dados completos do contato no Chatwoot
                cw_conv = await cw_get_conversation(conv["id"])
                meta = cw_conv.get("meta", {})
                sender = meta.get("sender", {})
                cw_email = sender.get("email", "")
                cw_phone = sender.get("phone_number", "")

                # Verifica se já existe pelo email ou telefone
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
        # Segurança: max 20 páginas pra não loopar infinito
        if page > 20:
            break

    db.commit()
    return {"synced": synced, "created": created, "errors": errors}
