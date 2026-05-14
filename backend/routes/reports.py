from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict
from datetime import datetime, timedelta
from database import get_db
from models import Contact, Company, Deal, Task, Activity

router = APIRouter(prefix="/api/reports", tags=["Reports"])

STAGES = ["prospecção", "apresentação", "proposta", "negociação", "fechamento"]


@router.get("/pipeline")
def pipeline(db: Session = Depends(get_db)):
    deals = db.query(Deal).all()
    result = []
    for stage in STAGES:
        stage_deals = [d for d in deals if d.stage == stage]
        result.append({
            "stage": stage,
            "count": len(stage_deals),
            "value": sum(d.value or 0 for d in stage_deals),
        })
    return result


@router.get("/revenue")
def revenue(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    deals = db.query(Deal).filter(Deal.status == "ganho").all()
    monthly = defaultdict(float)
    for d in deals:
        month_key = d.created_at.strftime("%Y-%m") if d.created_at else "unknown"
        monthly[month_key] += d.value or 0
    result = []
    for i in range(5, -1, -1):
        date = now - timedelta(days=30 * i)
        key = date.strftime("%Y-%m")
        result.append({
            "month": key,
            "label": date.strftime("%b/%Y"),
            "value": monthly.get(key, 0),
        })
    return result


@router.get("/conversion")
def conversion(db: Session = Depends(get_db)):
    total = db.query(Deal).count()
    won = db.query(Deal).filter(Deal.status == "ganho").count()
    rate = (won / total * 100) if total > 0 else 0
    return {"total": total, "won": won, "rate": round(rate, 1)}


@router.get("/top-contacts")
def top_contacts(db: Session = Depends(get_db)):
    deals = db.query(Deal).all()
    contact_deals = defaultdict(lambda: {"count": 0, "value": 0})
    for d in deals:
        if d.contact_id:
            contact_deals[d.contact_id]["count"] += 1
            contact_deals[d.contact_id]["value"] += d.value or 0
    result = []
    for cid, data in sorted(contact_deals.items(), key=lambda x: -x[1]["count"])[:5]:
        contact = db.query(Contact).filter(Contact.id == cid).first()
        if contact:
            result.append({
                "id": contact.id,
                "name": contact.name,
                "deals_count": data["count"],
                "deals_value": data["value"],
            })
    return result


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    deals = db.query(Deal).all()
    won_deals = [d for d in deals if d.status == "ganho"]
    active_deals = [d for d in deals if d.status not in ("ganho", "perdido")]
    total_won = sum(d.value or 0 for d in won_deals)
    avg_ticket = total_won / len(won_deals) if won_deals else 0
    return {
        "total_won": total_won,
        "avg_ticket": round(avg_ticket, 2),
        "active_deals": len(active_deals),
        "total_deals": len(deals),
        "won_count": len(won_deals),
        "lost_count": len([d for d in deals if d.status == "perdido"]),
    }
