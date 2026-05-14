from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from database import get_db
from models import Deal, Task, Activity

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def get_notifications(db: Session = Depends(get_db)):
    alerts = []
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Overdue tasks
    overdue_tasks = (
        db.query(Task)
        .filter(Task.completed == False, Task.due_date != None, Task.due_date < today_start)
        .all()
    )
    for t in overdue_tasks:
        alerts.append({
            "type": "task",
            "severity": "danger",
            "message": f'Tarefa vencida: "{t.title}"',
            "detail": f'Venceu em {t.due_date.strftime("%d/%m/%Y")}',
            "task_id": t.id,
            "deal_id": t.deal_id,
        })

    # Tasks due today
    today_tasks = (
        db.query(Task)
        .filter(Task.completed == False, Task.due_date >= today_start, Task.due_date <= today_end)
        .all()
    )
    for t in today_tasks:
        alerts.append({
            "type": "task",
            "severity": "warning",
            "message": f'Tarefa para hoje: "{t.title}"',
            "detail": "Vence hoje",
            "task_id": t.id,
            "deal_id": t.deal_id,
        })

    # Deals without activity for 7+ days
    deals = db.query(Deal).filter(Deal.status.notin_(["ganho", "perdido"])).all()
    for d in deals:
        last_activity = (
            db.query(Activity)
            .filter(Activity.deal_id == d.id)
            .order_by(Activity.created_at.desc())
            .first()
        )
        threshold = now - timedelta(days=7)
        last_date = last_activity.created_at if last_activity else d.created_at
        if last_date and last_date < threshold:
            days = (now - last_date).days
            alerts.append({
                "type": "deal",
                "severity": "warning",
                "message": f'Deal parado: "{d.title}"',
                "detail": f"Sem atividade há {days} dias",
                "deal_id": d.id,
            })

    return alerts
