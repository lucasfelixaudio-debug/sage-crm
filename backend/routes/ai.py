import os
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from pathlib import Path

from database import get_db
from models import Contact, Company, Deal, Task, Activity

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])

SYSTEM_PROMPT = """Você é o assistente IA do SageCRM — um CRM inteligente para gestão de vendas e contatos.

Você ajuda o usuário a:
- Responder perguntas sobre os dados do CRM (contatos, deals, tarefas)
- Criar contatos, deals e tarefas
- Resumir atividades de um contato
- Sugerir próximas ações em deals parados
- Buscar e filtrar dados por linguagem natural
- Analisar pipeline e dar insights de vendas

Regras:
- Responda sempre em português brasileiro
- Seja direto e objetivo
- Use formatação markdown quando útil (listas, negrito, tabelas)
- Quando precisar criar algo, retorne um bloco JSON assim:

[ACTION]
{"action": "create_contact", "data": {"name": "...", "email": "...", "phone": "..."}}
[/ACTION]

Ações disponíveis:
- create_contact: {"action": "create_contact", "data": {"name", "email", "phone"}}
- create_deal: {"action": "create_deal", "data": {"title", "value", "stage", "contact_id"}}
- create_task: {"action": "create_task", "data": {"title", "description", "contact_id", "deal_id"}}
- update_deal_stage: {"action": "update_deal_stage", "data": {"deal_id", "stage"}}

Quando o usuário pedir para criar algo, gere a action e pergunte se ele confirma.
"""


class ChatMessage(BaseModel):
    message: str
    history: Optional[List[dict]] = []

class ActionRequest(BaseModel):
    action: str
    data: dict


def build_context(db: Session) -> str:
    """Build dynamic context from database for the AI"""
    lines = ["=== CONTEXTO ATUAL DO CRM ===\n"]

    # Contacts
    contacts = db.query(Contact).all()
    lines.append(f"Contatos ({len(contacts)}):")
    for c in contacts[:20]:
        lines.append(f"  - #{c.id} {c.name} | {c.email} | {c.phone or 'sem tel'}")

    # Deals by stage
    deals = db.query(Deal).all()
    stages = {}
    for d in deals:
        stages.setdefault(d.stage, []).append(d)
    lines.append(f"\nDeals ({len(deals)}):")
    for stage, stage_deals in stages.items():
        total_value = sum(d.value or 0 for d in stage_deals)
        lines.append(f"  {stage}: {len(stage_deals)} deals | R$ {total_value:,.2f}")
        for d in stage_deals[:5]:
            lines.append(f"    - #{d.id} {d.title} (R$ {d.value or 0:,.2f})")

    # Tasks
    tasks = db.query(Task).all()
    pending = [t for t in tasks if not t.completed]
    lines.append(f"\nTarefas: {len(pending)} pendentes de {len(tasks)} total")
    for t in pending[:10]:
        lines.append(f"  - #{t.id} {t.title}")

    # Companies
    companies = db.query(Company).all()
    lines.append(f"\nEmpresas ({len(companies)}):")
    for co in companies[:10]:
        lines.append(f"  - #{co.id} {co.name} | {co.industry or '-'}")

    lines.append("\n=== FIM DO CONTEXTO ===")
    return "\n".join(lines)


def get_anthropic_client():
    # Limpa env residual do sistema e força leitura do .env
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path, override=True)
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or "SUA_CHAVE" in api_key.upper():
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY não configurada. Adicione no backend/.env")
    import anthropic
    return anthropic.Anthropic(api_key=api_key)


@router.post("/chat")
async def chat(msg: ChatMessage, db: Session = Depends(get_db)):
    client = get_anthropic_client()
    context = build_context(db)

    messages = msg.history + [{"role": "user", "content": msg.message}]

    def stream_response():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=SYSTEM_PROMPT + "\n\n" + context,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@router.post("/action")
def execute_action(req: ActionRequest, db: Session = Depends(get_db)):
    action = req.action
    data = req.data

    if action == "create_contact":
        contact = Contact(
            name=data.get("name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return {"success": True, "type": "contact", "id": contact.id, "name": contact.name}

    elif action == "create_deal":
        deal = Deal(
            title=data.get("title", ""),
            value=float(data.get("value", 0)),
            stage=data.get("stage", "prospecção"),
            status=data.get("status", "novo"),
            contact_id=data.get("contact_id"),
            company_id=data.get("company_id"),
        )
        db.add(deal)
        db.commit()
        db.refresh(deal)
        return {"success": True, "type": "deal", "id": deal.id, "title": deal.title}

    elif action == "create_task":
        task = Task(
            title=data.get("title", ""),
            description=data.get("description", ""),
            contact_id=data.get("contact_id"),
            deal_id=data.get("deal_id"),
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return {"success": True, "type": "task", "id": task.id, "title": task.title}

    elif action == "update_deal_stage":
        deal = db.query(Deal).filter(Deal.id == data.get("deal_id")).first()
        if not deal:
            raise HTTPException(status_code=404, detail="Deal não encontrado")
        deal.stage = data.get("stage", deal.stage)
        db.commit()
        return {"success": True, "type": "deal_update", "id": deal.id, "stage": deal.stage}

    else:
        raise HTTPException(status_code=400, detail=f"Ação desconhecida: {action}")
