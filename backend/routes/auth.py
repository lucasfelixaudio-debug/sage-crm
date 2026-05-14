from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import jwt, JWTError
import bcrypt
from datetime import datetime, timedelta
from database import get_db, SessionLocal
from models import User

router = APIRouter(prefix="/api/auth", tags=["Auth"])

SECRET = "sagecrm-secret-key-dev-2026"
ALGO = "HS256"


class RegisterSchema(BaseModel):
    name: str
    email: str
    password: str
    role: str = "vendedor"


class LoginSchema(BaseModel):
    email: str
    password: str


def hash_pw(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw, hashed):
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def create_token(user_id: int):
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=24),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        return int(payload.get("sub"))
    except JWTError:
        return None


def get_current_user(request: Request) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token não fornecido")
    user_id = decode_token(auth.split(" ")[1])
    if not user_id:
        raise HTTPException(401, "Token inválido")
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    db.close()
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user


@router.post("/register")
def register(data: RegisterSchema, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email já cadastrado")
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_pw(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }


@router.post("/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_pw(data.password, user.password_hash):
        raise HTTPException(401, "Email ou senha inválidos")
    token = create_token(user.id)
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }


@router.get("/me")
def me(request: Request):
    user = get_current_user(request)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
