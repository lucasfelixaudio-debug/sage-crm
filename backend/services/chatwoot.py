import os
import httpx
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(env_path, override=True)

CHATWOOT_URL = os.getenv("CHATWOOT_URL", "").rstrip("/")
CHATWOOT_ACCOUNT_ID = os.getenv("CHATWOOT_ACCOUNT_ID", "")
CHATWOOT_INBOX_ID = os.getenv("CHATWOOT_INBOX_ID", "")
CHATWOOT_API_TOKEN = os.getenv("CHATWOOT_API_TOKEN", "")


def _headers():
    return {"api_access_token": CHATWOOT_API_TOKEN, "Content-Type": "application/json"}


def _base_url():
    return f"{CHATWOOT_URL}/api/v1/accounts/{CHATWOOT_ACCOUNT_ID}"


def _configured():
    return bool(
        CHATWOOT_URL
        and CHATWOOT_ACCOUNT_ID
        and CHATWOOT_API_TOKEN
        and CHATWOOT_API_TOKEN != "COLE_O_TOKEN_AQUI"
    )


def _check_config():
    """Retorna (ok, error_msg). Se ok=False, lança HTTPException apropriada."""
    if not CHATWOOT_URL or not CHATWOOT_ACCOUNT_ID or not CHATWOOT_API_TOKEN:
        return False, "Configure CHATWOOT_URL, CHATWOOT_ACCOUNT_ID e CHATWOOT_API_TOKEN no .env"
    if CHATWOOT_API_TOKEN == "COLE_O_TOKEN_AQUI":
        return False, "Substitua COLE_O_TOKEN_AQUI pelo token real no .env"
    return True, None


async def _request(method: str, path: str, **kwargs):
    """Request genérico com tratamento de erros padronizado."""
    ok, err = _check_config()
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=err)

    url = f"{_base_url()}{path}"
    print(f"[Chatwoot] {method.upper()} {path}")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.request(method, url, headers=_headers(), **kwargs)

            if r.status_code == 401:
                from fastapi import HTTPException
                raise HTTPException(status_code=401, detail="Token Chatwoot inválido")

            r.raise_for_status()
            return r.json()

    except httpx.ConnectTimeout:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Timeout ao conectar ao Chatwoot")
    except httpx.ConnectError:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Não foi possível conectar ao Chatwoot")
    except Exception as e:
        if "HTTPException" in type(e).__name__:
            raise
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"Erro Chatwoot: {e}")


async def test_connection():
    ok, err = _check_config()
    if not ok:
        return {"connected": False, "error": err}

    data = await _request("GET", "/conversations", params={"page": 1})
    inner = data.get("data", data)
    meta = inner.get("meta", {}) if isinstance(inner, dict) else {}
    count = meta.get("all_count", 0)
    return {
        "connected": True,
        "account_id": int(CHATWOOT_ACCOUNT_ID),
        "inbox_id": int(CHATWOOT_INBOX_ID) if CHATWOOT_INBOX_ID else None,
        "total_conversations": count,
    }


async def get_conversations(page: int = 1, status: str = None, limit: int = 10):
    params = {"page": page}
    if status:
        params["status"] = status

    data = await _request("GET", "/conversations", params=params)

    # Chatwoot retorna { data: { meta: {...}, payload: [...] } }
    inner = data.get("data", data)
    conversations = inner.get("payload", []) if isinstance(inner, dict) else []
    meta = inner.get("meta", {}) if isinstance(inner, dict) else {}

    # Simplificar resposta
    simplified = []
    for conv in conversations[:limit]:
        conv_meta = conv.get("meta", {})
        sender = conv_meta.get("sender", {})

        # Última mensagem
        last_msg = conv.get("last_non_activity_message")
        if not last_msg:
            messages = conv.get("messages", [])
            last_msg = messages[-1] if messages else {}
        if last_msg is None:
            last_msg = {}

        simplified.append({
            "id": conv.get("id"),
            "contact_name": sender.get("name", "Desconhecido"),
            "contact_avatar": sender.get("thumbnail", ""),
            "last_message": last_msg.get("content", ""),
            "last_activity_at": conv.get("last_activity_at"),
            "status": conv.get("status", ""),
            "unread_count": conv.get("unread_count", 0),
            "inbox_id": conv.get("inbox_id"),
        })

    return {
        "conversations": simplified,
        "page": page,
        "total": meta.get("all_count", len(conversations)),
    }


async def get_conversation(conversation_id: int):
    return await _request("GET", f"/conversations/{conversation_id}")


async def get_contact(contact_id: int):
    return await _request("GET", f"/contacts/{contact_id}")


async def send_message(conversation_id: int, content: str):
    return await _request(
        "POST",
        f"/conversations/{conversation_id}/messages",
        json={"content": content},
    )
