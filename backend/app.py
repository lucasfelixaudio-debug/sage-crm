from fastapi import FastAPI, Depends, HTTPException, Request
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

from database import engine, get_db, Base, SessionLocal
from models import Contact, Company, Deal, Task, Activity, User
from routes.ai import router as ai_router
from routes.auth import router as auth_router, hash_pw
from routes.reports import router as reports_router
from routes.search import router as search_router
from routes.notifications import router as notifications_router
from routes.whatsapp import router as whatsapp_router
from routes.email import router as email_router
from routes.calendar import router as calendar_router
from routes.webhooks import router as webhooks_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SageCRM")

app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(reports_router)
app.include_router(search_router)
app.include_router(notifications_router)
app.include_router(whatsapp_router)
app.include_router(email_router)
app.include_router(calendar_router)
app.include_router(webhooks_router)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "https://sage-crm-three.vercel.app",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth Middleware ───────────────────────────────────────────────────────────

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    public_paths = ["/", "/docs", "/openapi.json", "/redoc"]
    if path.startswith("/api/auth") or path.startswith("/api/whatsapp/webhook") or path in public_paths:
        return await call_next(request)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Não autenticado"})
    from routes.auth import decode_token
    user_id = decode_token(auth.split(" ")[1])
    if not user_id:
        return JSONResponse(status_code=401, content={"detail": "Token inválido"})
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    db.close()
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Usuário não encontrado"})
    request.state.user = user
    return await call_next(request)


# ── Schemas ──────────────────────────────────────────────────────────────────

class CompanySchema(BaseModel):
    id: Optional[int] = None
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    class Config:
        from_attributes = True

class ContactSchema(BaseModel):
    id: Optional[int] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company_id: Optional[int] = None
    owner_id: Optional[int] = None
    class Config:
        from_attributes = True

class DealSchema(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    value: Optional[float] = 0
    status: str = "novo"
    stage: str = "prospecção"
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    owner_id: Optional[int] = None
    class Config:
        from_attributes = True

class TaskSchema(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: bool = False
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    owner_id: Optional[int] = None
    class Config:
        from_attributes = True

class ActivitySchema(BaseModel):
    id: Optional[int] = None
    type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    user_id: Optional[int] = None
    class Config:
        from_attributes = True


# ── Companies ────────────────────────────────────────────────────────────────

@app.get("/api/companies", response_model=List[CompanySchema])
def list_companies(db: Session = Depends(get_db)):
    return db.query(Company).all()

@app.post("/api/companies", response_model=CompanySchema)
def create_company(company: CompanySchema, db: Session = Depends(get_db)):
    db_obj = Company(**company.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@app.get("/api/companies/{company_id}", response_model=CompanySchema)
def get_company(company_id: int, db: Session = Depends(get_db)):
    obj = db.query(Company).filter(Company.id == company_id).first()
    if not obj:
        raise HTTPException(404, "Empresa não encontrada")
    return obj

@app.put("/api/companies/{company_id}", response_model=CompanySchema)
def update_company(company_id: int, company: CompanySchema, db: Session = Depends(get_db)):
    db_obj = db.query(Company).filter(Company.id == company_id).first()
    if not db_obj:
        raise HTTPException(404, "Empresa não encontrada")
    for k, v in company.dict().items():
        setattr(db_obj, k, v)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@app.delete("/api/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    obj = db.query(Company).filter(Company.id == company_id).first()
    if not obj:
        raise HTTPException(404, "Empresa não encontrada")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# ── Contacts ─────────────────────────────────────────────────────────────────

@app.get("/api/contacts", response_model=List[ContactSchema])
def list_contacts(db: Session = Depends(get_db)):
    return db.query(Contact).all()

@app.post("/api/contacts", response_model=ContactSchema)
def create_contact(contact: ContactSchema, db: Session = Depends(get_db)):
    db_obj = Contact(**contact.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    from routes.webhooks import dispatch_webhook
    dispatch_webhook("contact_created", {"id": db_obj.id, "name": db_obj.name, "email": db_obj.email})
    return db_obj

@app.get("/api/contacts/{contact_id}", response_model=ContactSchema)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    obj = db.query(Contact).filter(Contact.id == contact_id).first()
    if not obj:
        raise HTTPException(404, "Contato não encontrado")
    return obj

@app.put("/api/contacts/{contact_id}", response_model=ContactSchema)
def update_contact(contact_id: int, contact: ContactSchema, db: Session = Depends(get_db)):
    db_obj = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_obj:
        raise HTTPException(404, "Contato não encontrado")
    for k, v in contact.dict().items():
        setattr(db_obj, k, v)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    obj = db.query(Contact).filter(Contact.id == contact_id).first()
    if not obj:
        raise HTTPException(404, "Contato não encontrado")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# ── Deals ────────────────────────────────────────────────────────────────────

@app.get("/api/deals", response_model=List[DealSchema])
def list_deals(db: Session = Depends(get_db)):
    return db.query(Deal).all()

@app.post("/api/deals", response_model=DealSchema)
def create_deal(deal: DealSchema, db: Session = Depends(get_db)):
    db_obj = Deal(**deal.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@app.get("/api/deals/{deal_id}", response_model=DealSchema)
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    obj = db.query(Deal).filter(Deal.id == deal_id).first()
    if not obj:
        raise HTTPException(404, "Negócio não encontrado")
    return obj

@app.put("/api/deals/{deal_id}", response_model=DealSchema)
def update_deal(deal_id: int, deal: DealSchema, db: Session = Depends(get_db)):
    db_obj = db.query(Deal).filter(Deal.id == deal_id).first()
    if not db_obj:
        raise HTTPException(404, "Negócio não encontrado")
    for k, v in deal.dict().items():
        setattr(db_obj, k, v)
    db.commit()
    db.refresh(db_obj)
    from routes.webhooks import dispatch_webhook
    dispatch_webhook("deal_updated", {"id": db_obj.id, "title": db_obj.title, "stage": db_obj.stage, "status": db_obj.status})
    return db_obj

@app.delete("/api/deals/{deal_id}")
def delete_deal(deal_id: int, db: Session = Depends(get_db)):
    obj = db.query(Deal).filter(Deal.id == deal_id).first()
    if not obj:
        raise HTTPException(404, "Negócio não encontrado")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# ── Tasks ────────────────────────────────────────────────────────────────────

@app.get("/api/tasks", response_model=List[TaskSchema])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()

@app.post("/api/tasks", response_model=TaskSchema)
def create_task(task: TaskSchema, db: Session = Depends(get_db)):
    db_obj = Task(**task.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    from routes.webhooks import dispatch_webhook
    dispatch_webhook("task_created", {"id": db_obj.id, "title": db_obj.title, "due_date": str(db_obj.due_date) if db_obj.due_date else None})
    return db_obj

@app.get("/api/tasks/{task_id}", response_model=TaskSchema)
def get_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(Task).filter(Task.id == task_id).first()
    if not obj:
        raise HTTPException(404, "Tarefa não encontrada")
    return obj

@app.put("/api/tasks/{task_id}", response_model=TaskSchema)
def update_task(task_id: int, task: TaskSchema, db: Session = Depends(get_db)):
    db_obj = db.query(Task).filter(Task.id == task_id).first()
    if not db_obj:
        raise HTTPException(404, "Tarefa não encontrada")
    for k, v in task.dict().items():
        setattr(db_obj, k, v)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(Task).filter(Task.id == task_id).first()
    if not obj:
        raise HTTPException(404, "Tarefa não encontrada")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# ── Activities ───────────────────────────────────────────────────────────────

@app.get("/api/activities", response_model=List[ActivitySchema])
def list_activities(contact_id: Optional[int] = None, deal_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Activity)
    if contact_id:
        q = q.filter(Activity.contact_id == contact_id)
    if deal_id:
        q = q.filter(Activity.deal_id == deal_id)
    return q.order_by(Activity.created_at.desc()).all()

@app.post("/api/activities", response_model=ActivitySchema)
def create_activity(activity: ActivitySchema, db: Session = Depends(get_db)):
    db_obj = Activity(**activity.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@app.delete("/api/activities/{activity_id}")
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    obj = db.query(Activity).filter(Activity.id == activity_id).first()
    if not obj:
        raise HTTPException(404, "Atividade não encontrada")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# ── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_contacts = db.query(Contact).count()
    total_companies = db.query(Company).count()
    total_deals = db.query(Deal).count()
    total_deals_value = sum(d.value or 0 for d in db.query(Deal).all())
    total_tasks = db.query(Task).count()
    pending_tasks = db.query(Task).filter(Task.completed == False).count()
    return {
        "total_contacts": total_contacts,
        "total_companies": total_companies,
        "total_deals": total_deals,
        "total_deals_value": total_deals_value,
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
    }


@app.get("/")
def root():
    return {"message": "SageCRM API — Docs em /docs"}


# ── Seed ─────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def seed_data():
    db = SessionLocal()
    if db.query(User).first():
        db.close()
        return

    # Admin user
    admin = User(name="Admin", email="admin@sage.com", password_hash=hash_pw("admin123"), role="admin")
    db.add(admin)
    db.flush()

    companies = [
        Company(name="Tech Solutions Ltda", industry="Tecnologia", website="techsol.com.br"),
        Company(name="Marketing Pro SA", industry="Marketing", website="marketingpro.com.br"),
        Company(name="Construções ABC", industry="Construção", website=""),
    ]
    db.add_all(companies)
    db.flush()

    contacts = [
        Contact(name="João Silva", email="joao@techsol.com.br", phone="(11) 99999-1111", company_id=companies[0].id, owner_id=admin.id),
        Contact(name="Maria Oliveira", email="maria@marketingpro.com.br", phone="(21) 98888-2222", company_id=companies[1].id, owner_id=admin.id),
        Contact(name="Carlos Santos", email="carlos@gmail.com", phone="(31) 97777-3333", company_id=companies[2].id, owner_id=admin.id),
        Contact(name="Ana Costa", email="ana@techsol.com.br", phone="(11) 96666-4444", company_id=companies[0].id, owner_id=admin.id),
        Contact(name="Pedro Lima", email="pedro@startup.io", phone="(41) 95555-5555", owner_id=admin.id),
    ]
    db.add_all(contacts)
    db.flush()

    deals = [
        Deal(title="Website Corporativo", value=15000, status="novo", stage="prospecção", contact_id=contacts[0].id, company_id=companies[0].id, owner_id=admin.id),
        Deal(title="Campanha Digital Q3", value=8000, status="contato", stage="qualificação", contact_id=contacts[1].id, company_id=companies[1].id, owner_id=admin.id),
        Deal(title="App Mobile", value=45000, status="proposta", stage="proposta", contact_id=contacts[0].id, company_id=companies[0].id, owner_id=admin.id),
        Deal(title="Consultoria SEO", value=5000, status="negociação", stage="negociação", contact_id=contacts[4].id, owner_id=admin.id),
        Deal(title="Sistema ERP", value=120000, status="novo", stage="prospecção", contact_id=contacts[2].id, company_id=companies[2].id, owner_id=admin.id),
        Deal(title="Redesign Landing Page", value=3500, status="ganho", stage="fechamento", contact_id=contacts[3].id, company_id=companies[0].id, owner_id=admin.id),
        Deal(title="Gestão de Redes Sociais", value=2000, status="perdido", stage="fechamento", contact_id=contacts[1].id, company_id=companies[1].id, owner_id=admin.id),
    ]
    db.add_all(deals)
    db.flush()

    tasks = [
        Task(title="Ligar para João", description="Agendar reunião sobre o site", contact_id=contacts[0].id, deal_id=deals[0].id, owner_id=admin.id),
        Task(title="Enviar proposta Mobile", description="Incluir cronograma detalhado", deal_id=deals[2].id, owner_id=admin.id),
        Task(title="Follow-up Maria", description="Verificar feedback da campanha", contact_id=contacts[1].id, deal_id=deals[1].id, completed=True, owner_id=admin.id),
    ]
    db.add_all(tasks)

    db.commit()
    db.close()
    print("Seed OK! Admin: admin@sage.com / admin123")
