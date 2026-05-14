"""CRM Kommo — API REST completa."""
import json
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from models import db, Pipeline, Stage, Contact, Company, Deal, Task, Note, CustomField, CustomValue

api = Blueprint("api", __name__, url_prefix="/api")


# ── helpers ──────────────────────────────────────────────────────────────────
def _body():
    return request.get_json(force=True, silent=True) or {}


# ── Pipelines ────────────────────────────────────────────────────────────────
@api.route("/pipelines", methods=["GET"])
def list_pipelines():
    pipes = Pipeline.query.order_by(Pipeline.sort_order).all()
    return jsonify([p.to_dict() for p in pipes])


@api.route("/pipelines", methods=["POST"])
def create_pipeline():
    d = _body()
    p = Pipeline(name=d.get("name", "Novo Pipeline"), sort_order=d.get("sort_order", 0))
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@api.route("/pipelines/<int:pid>", methods=["PUT"])
def update_pipeline(pid):
    p = Pipeline.query.get_or_404(pid)
    d = _body()
    if "name" in d:
        p.name = d["name"]
    if "sort_order" in d:
        p.sort_order = d["sort_order"]
    db.session.commit()
    return jsonify(p.to_dict())


@api.route("/pipelines/<int:pid>", methods=["DELETE"])
def delete_pipeline(pid):
    p = Pipeline.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return "", 204


# ── Stages ───────────────────────────────────────────────────────────────────
@api.route("/pipelines/<int:pid>/stages", methods=["POST"])
def create_stage(pid):
    Pipeline.query.get_or_404(pid)
    d = _body()
    s = Stage(
        pipeline_id=pid,
        name=d.get("name", "Nova Etapa"),
        color=d.get("color", "#6c757d"),
        sort_order=d.get("sort_order", 0),
        is_won=d.get("is_won", False),
        is_lost=d.get("is_lost", False),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@api.route("/stages/<int:sid>", methods=["PUT"])
def update_stage(sid):
    s = Stage.query.get_or_404(sid)
    d = _body()
    for k in ("name", "color", "sort_order", "is_won", "is_lost"):
        if k in d:
            setattr(s, k, d[k])
    db.session.commit()
    return jsonify(s.to_dict())


@api.route("/stages/<int:sid>", methods=["DELETE"])
def delete_stage(sid):
    s = Stage.query.get_or_404(sid)
    if s.deals.count() > 0:
        return jsonify({"error": "Etapa tem negócios vinculados"}), 400
    db.session.delete(s)
    db.session.commit()
    return "", 204


# ── Contacts ─────────────────────────────────────────────────────────────────
@api.route("/contacts", methods=["GET"])
def list_contacts():
    q = Contact.query
    search = request.args.get("q", "").strip()
    if search:
        q = q.filter(Contact.name.ilike(f"%{search}%"))
    contacts = q.order_by(Contact.name).all()
    return jsonify([c.to_dict(include_custom=True) for c in contacts])


@api.route("/contacts/<int:cid>", methods=["GET"])
def get_contact(cid):
    c = Contact.query.get_or_404(cid)
    return jsonify(c.to_dict(include_custom=True))


@api.route("/contacts", methods=["POST"])
def create_contact():
    d = _body()
    c = Contact(
        name=d.get("name"),
        email=d.get("email"),
        phone=d.get("phone"),
        avatar_color=d.get("avatar_color", "#4f46e5"),
        company_id=d.get("company_id"),
    )
    db.session.add(c)
    db.session.flush()
    _save_custom_values(d.get("custom_values", []), "contact", contact_id=c.id)
    db.session.commit()
    return jsonify(c.to_dict(include_custom=True)), 201


@api.route("/contacts/<int:cid>", methods=["PUT"])
def update_contact(cid):
    c = Contact.query.get_or_404(cid)
    d = _body()
    for k in ("name", "email", "phone", "avatar_color", "company_id"):
        if k in d:
            setattr(c, k, d[k])
    _save_custom_values(d.get("custom_values", []), "contact", contact_id=c.id)
    db.session.commit()
    return jsonify(c.to_dict(include_custom=True))


@api.route("/contacts/<int:cid>", methods=["DELETE"])
def delete_contact(cid):
    c = Contact.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    return "", 204


# ── Companies ────────────────────────────────────────────────────────────────
@api.route("/companies", methods=["GET"])
def list_companies():
    q = Company.query
    search = request.args.get("q", "").strip()
    if search:
        q = q.filter(Company.name.ilike(f"%{search}%"))
    companies = q.order_by(Company.name).all()
    return jsonify([co.to_dict(include_custom=True) for co in companies])


@api.route("/companies/<int:coid>", methods=["GET"])
def get_company(coid):
    co = Company.query.get_or_404(coid)
    return jsonify(co.to_dict(include_custom=True))


@api.route("/companies", methods=["POST"])
def create_company():
    d = _body()
    co = Company(
        name=d.get("name"),
        website=d.get("website"),
        industry=d.get("industry"),
    )
    db.session.add(co)
    db.session.flush()
    _save_custom_values(d.get("custom_values", []), "company", company_id=co.id)
    db.session.commit()
    return jsonify(co.to_dict(include_custom=True)), 201


@api.route("/companies/<int:coid>", methods=["PUT"])
def update_company(coid):
    co = Company.query.get_or_404(coid)
    d = _body()
    for k in ("name", "website", "industry"):
        if k in d:
            setattr(co, k, d[k])
    _save_custom_values(d.get("custom_values", []), "company", company_id=co.id)
    db.session.commit()
    return jsonify(co.to_dict(include_custom=True))


@api.route("/companies/<int:coid>", methods=["DELETE"])
def delete_company(coid):
    co = Company.query.get_or_404(coid)
    db.session.delete(co)
    db.session.commit()
    return "", 204


# ── Deals ────────────────────────────────────────────────────────────────────
@api.route("/deals", methods=["GET"])
def list_deals():
    q = Deal.query
    stage_id = request.args.get("stage_id", type=int)
    pipeline_id = request.args.get("pipeline_id", type=int)
    if stage_id:
        q = q.filter_by(stage_id=stage_id)
    if pipeline_id:
        q = q.join(Stage).filter(Stage.pipeline_id == pipeline_id)
    deals = q.order_by(Deal.created_at.desc()).all()
    return jsonify([d.to_dict(include_custom=True) for d in deals])


@api.route("/deals/<int:did>", methods=["GET"])
def get_deal(did):
    d = Deal.query.get_or_404(did)
    return jsonify(d.to_dict(include_custom=True))


@api.route("/deals", methods=["POST"])
def create_deal():
    d = _body()
    deal = Deal(
        title=d.get("title"),
        value=d.get("value", 0),
        currency=d.get("currency", "BRL"),
        stage_id=d.get("stage_id"),
        contact_id=d.get("contact_id"),
        company_id=d.get("company_id"),
    )
    db.session.add(deal)
    db.session.flush()
    _save_custom_values(d.get("custom_values", []), "deal", deal_id=deal.id)
    db.session.commit()
    return jsonify(deal.to_dict(include_custom=True)), 201


@api.route("/deals/<int:did>", methods=["PUT"])
def update_deal(did):
    deal = Deal.query.get_or_404(did)
    d = _body()
    for k in ("title", "value", "currency", "stage_id", "contact_id", "company_id"):
        if k in d:
            setattr(deal, k, d[k])
    _save_custom_values(d.get("custom_values", []), "deal", deal_id=deal.id)
    db.session.commit()
    return jsonify(deal.to_dict(include_custom=True))


@api.route("/deals/<int:did>", methods=["DELETE"])
def delete_deal(did):
    deal = Deal.query.get_or_404(did)
    db.session.delete(deal)
    db.session.commit()
    return "", 204


# ── Tasks ────────────────────────────────────────────────────────────────────
@api.route("/deals/<int:did>/tasks", methods=["GET"])
def list_deal_tasks(did):
    tasks = Task.query.filter_by(deal_id=did).order_by(Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


@api.route("/deals/<int:did>/tasks", methods=["POST"])
def create_deal_task(did):
    Deal.query.get_or_404(did)
    d = _body()
    due = None
    if d.get("due_date"):
        due = datetime.fromisoformat(d["due_date"])
    t = Task(deal_id=did, text=d.get("text"), due_date=due)
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@api.route("/tasks/<int:tid>", methods=["PUT"])
def update_task(tid):
    t = Task.query.get_or_404(tid)
    d = _body()
    if "text" in d:
        t.text = d["text"]
    if "due_date" in d:
        t.due_date = datetime.fromisoformat(d["due_date"]) if d["due_date"] else None
    if "completed" in d:
        t.completed = d["completed"]
        t.completed_at = datetime.now(timezone.utc) if d["completed"] else None
    db.session.commit()
    return jsonify(t.to_dict())


@api.route("/tasks/<int:tid>", methods=["DELETE"])
def delete_task(tid):
    t = Task.query.get_or_404(tid)
    db.session.delete(t)
    db.session.commit()
    return "", 204


# ── Notes ────────────────────────────────────────────────────────────────────
@api.route("/deals/<int:did>/notes", methods=["GET"])
def list_deal_notes(did):
    notes = Note.query.filter_by(deal_id=did).order_by(Note.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notes])


@api.route("/deals/<int:did>/notes", methods=["POST"])
def create_deal_note(did):
    Deal.query.get_or_404(did)
    d = _body()
    n = Note(deal_id=did, text=d.get("text"))
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201


@api.route("/notes/<int:nid>", methods=["PUT"])
def update_note(nid):
    n = Note.query.get_or_404(nid)
    d = _body()
    if "text" in d:
        n.text = d["text"]
    db.session.commit()
    return jsonify(n.to_dict())


@api.route("/notes/<int:nid>", methods=["DELETE"])
def delete_note(nid):
    n = Note.query.get_or_404(nid)
    db.session.delete(n)
    db.session.commit()
    return "", 204


# ── Custom Fields (definições) ───────────────────────────────────────────────
@api.route("/custom-fields", methods=["GET"])
def list_custom_fields():
    entity = request.args.get("entity_type")
    q = CustomField.query
    if entity:
        q = q.filter_by(entity_type=entity)
    fields = q.order_by(CustomField.sort_order).all()
    return jsonify([f.to_dict() for f in fields])


@api.route("/custom-fields", methods=["POST"])
def create_custom_field():
    d = _body()
    opts = d.get("options", [])
    f = CustomField(
        entity_type=d.get("entity_type"),
        name=d.get("name"),
        field_type=d.get("field_type", "text"),
        options=json.dumps(opts) if opts else None,
        sort_order=d.get("sort_order", 0),
        required=d.get("required", False),
    )
    db.session.add(f)
    db.session.commit()
    return jsonify(f.to_dict()), 201


@api.route("/custom-fields/<int:fid>", methods=["PUT"])
def update_custom_field(fid):
    f = CustomField.query.get_or_404(fid)
    d = _body()
    for k in ("name", "field_type", "sort_order", "required"):
        if k in d:
            setattr(f, k, d[k])
    if "options" in d:
        f.options = json.dumps(d["options"]) if d["options"] else None
    db.session.commit()
    return jsonify(f.to_dict())


@api.route("/custom-fields/<int:fid>", methods=["DELETE"])
def delete_custom_field(fid):
    f = CustomField.query.get_or_404(fid)
    CustomValue.query.filter_by(field_id=fid).delete()
    db.session.delete(f)
    db.session.commit()
    return "", 204


# ── Dashboard stats ──────────────────────────────────────────────────────────
@api.route("/dashboard", methods=["GET"])
def dashboard():
    total_deals = Deal.query.count()
    total_contacts = Contact.query.count()
    total_companies = Company.query.count()
    open_deals_value = db.session.query(
        db.func.coalesce(db.func.sum(Deal.value), 0)
    ).join(Stage).filter(Stage.is_won == False, Stage.is_lost == False).scalar()
    won_value = db.session.query(
        db.func.coalesce(db.func.sum(Deal.value), 0)
    ).join(Stage).filter(Stage.is_won == True).scalar()
    pending_tasks = Task.query.filter_by(completed=False).count()
    return jsonify({
        "total_deals": total_deals,
        "total_contacts": total_contacts,
        "total_companies": total_companies,
        "open_deals_value": open_deals_value,
        "won_value": won_value,
        "pending_tasks": pending_tasks,
    })


# ── internal: save custom values ────────────────────────────────────────────
def _save_custom_values(values, entity_type, contact_id=None, company_id=None, deal_id=None):
    if not values:
        return
    for item in values:
        field_id = item.get("field_id")
        val = item.get("value", "")
        existing = CustomValue.query.filter_by(
            field_id=field_id, entity_type=entity_type,
            contact_id=contact_id, company_id=company_id, deal_id=deal_id,
        ).first()
        if existing:
            existing.value = val
        else:
            cv = CustomValue(
                field_id=field_id, entity_type=entity_type, value=val,
                contact_id=contact_id, company_id=company_id, deal_id=deal_id,
            )
            db.session.add(cv)
