from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(200))
    role = Column(String(20), default="vendedor")
    created_at = Column(DateTime, default=datetime.utcnow)


class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    email = Column(String(100), unique=True, index=True)
    phone = Column(String(20))
    company_id = Column(Integer, ForeignKey("companies.id"))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="contacts")
    deals = relationship("Deal", back_populates="contact")
    tasks = relationship("Task", back_populates="contact")


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    industry = Column(String(50))
    website = Column(String(200))
    contacts = relationship("Contact", back_populates="company")
    deals = relationship("Deal", back_populates="company")


class Deal(Base):
    __tablename__ = "deals"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), index=True)
    description = Column(Text)
    value = Column(Float)
    status = Column(String(20), default="novo")
    stage = Column(String(50), default="prospecção")
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    contact = relationship("Contact", back_populates="deals")
    company = relationship("Company", back_populates="deals")
    tasks = relationship("Task", back_populates="deal")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), index=True)
    description = Column(Text)
    due_date = Column(DateTime)
    completed = Column(Boolean, default=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    deal_id = Column(Integer, ForeignKey("deals.id"))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    contact = relationship("Contact", back_populates="tasks")
    deal = relationship("Deal", back_populates="tasks")


class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50))
    title = Column(String(100))
    description = Column(Text)
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailConfig(Base):
    __tablename__ = "email_configs"
    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String(200))
    smtp_port = Column(Integer, default=587)
    email = Column(String(200))
    password = Column(String(200))
    sender_name = Column(String(100))


class EmailSent(Base):
    __tablename__ = "emails_sent"
    id = Column(Integer, primary_key=True, index=True)
    to_email = Column(String(200))
    subject = Column(String(300))
    body = Column(Text)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)


class Webhook(Base):
    __tablename__ = "webhooks"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500))
    event = Column(String(50))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GoogleToken(Base):
    __tablename__ = "google_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token_json = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow)
