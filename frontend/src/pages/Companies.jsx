import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Edit3, Trash2, Globe, Factory } from 'lucide-react'

function Companies() {
  const [companies, setCompanies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ name: '', industry: '', website: '' })

  const load = () => {
    axios.get('/api/companies').then(r => setCompanies(r.data)).catch(console.error)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setFormData({ name: '', industry: '', website: '' })
    setShowForm(true)
  }

  function openEdit(c) {
    setEditing(c)
    setFormData({ name: c.name, industry: c.industry || '', website: c.website || '' })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editing) {
        await axios.put(`/api/companies/${editing.id}`, formData)
      } else {
        await axios.post('/api/companies', formData)
      }
      setFormData({ name: '', industry: '', website: '' })
      setShowForm(false)
      setEditing(null)
      load()
    } catch (err) { console.error(err) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir esta empresa?')) return
    try {
      await axios.delete(`/api/companies/${id}`)
      load()
    } catch (err) { console.error(err) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Empresas</h2>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nova Empresa</button>
      </div>

      {showForm && (
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <input type="text" placeholder="Nome da empresa *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            <div className="form-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Factory size={16} style={{ color: 'var(--text-light)' }} />
                <input type="text" placeholder="Indústria" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={16} style={{ color: 'var(--text-light)' }} />
                <input type="text" placeholder="Website" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
              </div>
            </div>
            <div className="form-buttons">
              <button type="submit" className="btn-primary">{editing ? 'Salvar' : 'Criar'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null) }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="list">
        {companies.length === 0 ? (
          <p className="empty-state">Nenhuma empresa. Crie uma nova!</p>
        ) : companies.map(c => (
          <div key={c.id} className="list-item">
            <div className="avatar" style={{ background: '#8b5cf6' }}>
              {c.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="item-info">
              <h3>{c.name}</h3>
              <p>{c.industry && <><Factory size={12} style={{marginRight: 4}} />{c.industry}</>}</p>
              <p>{c.website && <><Globe size={12} style={{marginRight: 4}} />{c.website}</>}</p>
            </div>
            <div className="item-actions">
              <button className="btn-icon" onClick={() => openEdit(c)}><Edit3 size={14} /></button>
              <button className="btn-icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Companies
