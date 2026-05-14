from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Contact, Company, Deal, Task

router = APIRouter(prefix="/api", tags=["Search"])


@router.get("/search")
def global_search(q: str = "", db: Session = Depends(get_db)):
    if not q or len(q) < 2:
        return {"contacts": [], "deals": [], "companies": [], "tasks": []}

    q_lower = f"%{q}%"

    contacts = (
        db.query(Contact)
        .filter((Contact.name.ilike(q_lower)) | (Contact.email.ilike(q_lower)))
        .limit(5)
        .all()
    )

    deals = (
        db.query(Deal)
        .filter(Deal.title.ilike(q_lower))
        .limit(5)
        .all()
    )

    companies = (
        db.query(Company)
        .filter((Company.name.ilike(q_lower)) | (Company.industry.ilike(q_lower)))
        .limit(5)
        .all()
    )

    tasks = (
        db.query(Task)
        .filter((Task.title.ilike(q_lower)) | (Task.description.ilike(q_lower)))
        .limit(5)
        .all()
    )

    return {
        "contacts": [{"id": c.id, "name": c.name, "email": c.email} for c in contacts],
        "deals": [{"id": d.id, "title": d.title, "value": d.value, "stage": d.stage} for d in deals],
        "companies": [{"id": c.id, "name": c.name, "industry": c.industry} for c in companies],
        "tasks": [{"id": t.id, "title": t.title, "completed": t.completed} for t in tasks],
    }
