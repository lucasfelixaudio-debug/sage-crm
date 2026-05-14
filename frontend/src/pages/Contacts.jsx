import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Edit3, Trash2, Phone, Mail, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'

function Contacts() {
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company_id: '' })

  const load = () => {
    Promise.all([
      axios.get('/api/contacts').then(r => r.data),
      axios.get('/api/companies').then(r => r.data),
    ]).then(([c, co]) => { setContacts(c); setCompanies(co) })
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setFormData({ name: '', email: '', phone: '', company_id: '' })
    setShowForm(true)
  }

  function openEdit(c) {
    setEditing(c)
    setFormData({ name: c.name, email: c.email || '', phone: c.phone || '', company_id: c.company_id || '' })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const data = { ...formData, company_id: formData.company_id ? parseInt(formData.company_id) : null }
    try {
      if (editing) {
        await axios.put(`/api/contacts/${editing.id}`, data)
      } else {
        await axios.post('/api/contacts', data)
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch (err) { console.error(err) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir este contato?')) return
    try {
      await axios.delete(`/api/contacts/${id}`)
      load()
    } catch (err) { console.error(err) }
  }

  const getCompanyName = (id) => companies.find(c => c.id === id)?.name || ''

  return (
    <div className="page">
      <div className="page-header">
        <h2>Contatos</h2>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Contato</button>
      </div>

      {showForm && (
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <input type="text" placeholder="Nome *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            <div className="form-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} style={{ color: 'var(--text-light)' }} />
                <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={16} style={{ color: 'var(--text-light)' }} />
                <input type="tel" placeholder="Telefone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>
            <select value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})}>
              <option value="">Sem empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="form-buttons">
              <button type="submit" className="btn-primary">{editing ? 'Salvar' : 'Criar'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null) }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="list">
        {contacts.length === 0 ? (
          <p className="empty-state">Nenhum contato. Crie um novo!</p>
        ) : contacts.map(c => (
          <div key={c.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/contacts/${c.id}`}>
            <div className="avatar" style={{ background: '#3b82f6' }}>
              {c.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="item-info">
              <h3>{c.name}</h3>
              <p><Mail size={12} style={{marginRight: 4}} />{c.email || '—'}</p>
              <p><Phone size={12} style={{marginRight: 4}} />{c.phone || '—'}</p>
            </div>
            {getCompanyName(c.company_id) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-light)' }}>
                <Building2 size={14} /> {getCompanyName(c.company_id)}
              </div>
            )}
            <div className="item-actions" onClick={e => e.stopPropagation()}>
              <button className="btn-icon" onClick={() => openEdit(c)}><Edit3 size={14} /></button>
              <button className="btn-icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Contacts
