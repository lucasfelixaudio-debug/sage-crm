#!/bin/bash
set -e
echo "Installing dependencies..."
pip install -r requirements.txt
echo "Creating tables + seed data..."
python -c "
from database import engine, Base, SessionLocal
from models import User, Contact, Company, Deal, Task, Activity, EmailConfig, EmailSent, Webhook, GoogleToken
from routes.auth import hash_pw
import os

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if not db.query(User).filter(User.email == 'admin@sage.com').first():
    admin = User(name='Admin', email='admin@sage.com', password_hash=hash_pw('admin123'), role='admin')
    db.add(admin)
    db.commit()
    print('Admin criado: admin@sage.com / admin123')
else:
    print('Admin ja existe, pulando seed')
db.close()
print('Build OK!')
"
