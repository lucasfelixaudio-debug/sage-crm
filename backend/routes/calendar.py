import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from database import get_db
from models import GoogleToken

load_dotenv()

router = APIRouter(prefix="/api/calendar", tags=["Google Calendar"])

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = "http://localhost:8000/api/calendar/callback"
SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _check_config():
    return bool(CLIENT_ID and CLIENT_SECRET)


@router.get("/auth")
def auth_url():
    if not _check_config():
        raise HTTPException(400, "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env primeiro")
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}"
        f"&response_type=code&scope={' '.join(SCOPES)}&access_type=offline&prompt=consent"
    )
    return {"url": url}


@router.get("/callback")
def callback(code: str, db: Session = Depends(get_db)):
    if not _check_config():
        raise HTTPException(400, "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env primeiro")
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    try:
        flow.fetch_token(code=code)
        creds = flow.credentials
        token_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes),
        }
        existing = db.query(GoogleToken).first()
        if existing:
            existing.token_json = json.dumps(token_data)
            existing.updated_at = __import__("datetime").datetime.utcnow()
        else:
            db.add(GoogleToken(token_json=json.dumps(token_data)))
        db.commit()
        return {"connected": True, "message": "Google Calendar conectado! Pode fechar esta aba."}
    except Exception as e:
        raise HTTPException(400, f"Erro na autenticação: {e}")


@router.get("/events")
def list_events(db: Session = Depends(get_db)):
    if not _check_config():
        raise HTTPException(400, "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env primeiro")
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    token_row = db.query(GoogleToken).first()
    if not token_row:
        raise HTTPException(400, "Google Calendar não conectado")

    try:
        creds_data = json.loads(token_row.token_json)
        creds = Credentials(**creds_data)
        service = build("calendar", "v3", credentials=creds)

        from datetime import datetime, timedelta
        now = datetime.utcnow().isoformat() + "Z"
        end = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        events_result = service.events().list(
            calendarId="primary", timeMin=now, timeMax=end, maxResults=10, singleEvents=True, orderBy="startTime"
        ).execute()
        events = events_result.get("items", [])
        return [
            {
                "id": e.get("id"),
                "summary": e.get("summary", "(sem título)"),
                "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date")),
                "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date")),
            }
            for e in events
        ]
    except Exception as e:
        raise HTTPException(500, f"Erro ao buscar eventos: {e}")


class SyncTask(BaseModel):
    title: str
    description: str = ""
    due_date: str  # ISO datetime


@router.post("/sync-task")
def sync_task(task: SyncTask, db: Session = Depends(get_db)):
    if not _check_config():
        raise HTTPException(400, "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env primeiro")
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    token_row = db.query(GoogleToken).first()
    if not token_row:
        raise HTTPException(400, "Google Calendar não conectado")

    try:
        creds_data = json.loads(token_row.token_json)
        creds = Credentials(**creds_data)
        service = build("calendar", "v3", credentials=creds)

        event = {
            "summary": task.title,
            "description": task.description,
            "start": {"dateTime": task.due_date, "timeZone": "America/Sao_Paulo"},
            "end": {"dateTime": task.due_date, "timeZone": "America/Sao_Paulo"},
        }
        result = service.events().insert(calendarId="primary", body=event).execute()
        return {"synced": True, "event_id": result.get("id"), "link": result.get("htmlLink")}
    except Exception as e:
        raise HTTPException(500, f"Erro ao criar evento: {e}")


@router.get("/status")
def status(db: Session = Depends(get_db)):
    if not _check_config():
        return {"connected": False, "configured": False, "message": "Google Calendar não configurado"}
    token = db.query(GoogleToken).first()
    return {"connected": token is not None, "configured": True}
