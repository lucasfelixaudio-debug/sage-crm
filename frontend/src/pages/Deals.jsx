import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const STAGES = [
  { key: 'prospecção', label: 'Prospecção', color: '#3b82f6' },
  { key: 'apresentação', label: 'Apresentação', color: '#f59e0b' },
  { key: 'proposta', label: 'Proposta', color: '#8b5cf6' },
  { key: 'negociação', label: 'Negociação', color: '#ec4899' },
  { key: 'fechamento', label: 'Fechamento', color: '#10b981' },
]

function formatCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getInitials(name) {
  return name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'
}

function Deals() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [dragDeal, setDragDeal] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', value: '', stage: 'prospecção', status: 'novo', contact_id: '', company_id: '' })

  const load = useCallback(() => {
    Promise.all([
      axios.get('/api/deals').then(r => r.data),
      axios.get('/api/contacts').then(r => r.data),
      axios.get('/api/companies').then(r => r.data),
    ]).then(([d, c, co]) => { setDeals(d); setContacts(c); setCompanies(co) })
      .catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  const getContactName = (id) => contacts.find(c => c.id === id)?.name || ''

  function handleDragStart(e, deal) {
    setDragDeal(deal)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e, stageKey) {
    e.preventDefault()
    if (!dragDeal || dragDeal.stage === stageKey) return
    axios.put(`/api/deals/${dragDeal.id}`, { ...dragDeal, stage: stageKey }).then(() => {
      setDeals(prev => prev.map(d => d.id === dragDeal.id ? { ...d, stage: stageKey } : d))
    }).catch(console.error)
    setDragDeal(null)
  }

  function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  async function handleSubmit(e) {
    e.preventDefault()
    await axios.post('/api/deals', {
      title: formData.title,
      description: formData.description || null,
      value: parseFloat(formData.value) || 0,
      stage: formData.stage,
      status: formData.status,
      contact_id: formData.contact_id ? parseInt(formData.contact_id) : null,
      company_id: formData.company_id ? parseInt(formData.company_id) : null,
    })
    setFormData({ title: '', description: '', value: '', stage: 'prospecção', status: 'novo', contact_id: '', company_id: '' })
    setShowForm(false)
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir este negócio?')) return
    await axios.delete(`/api/deals/${id}`)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Funil de Vendas</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Novo Negócio</button>
      </div>

      <div className="kanban">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key)
          const total = stageDeals.reduce((s, d) => s + (d.value || 0), 0)
          return (
            <div key={stage.key} className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, stage.key)}
            >
              <div className="kanban-column-header">
                <span className="dot" style={{ background: stage.color }} />
                {stage.label}
                <span className="count">{stageDeals.length}</span>
              </div>
              <div className="kanban-column-body">
                {stageDeals.map(deal => (
                  <div key={deal.id} className="kanban-card" draggable onDragStart={e => handleDragStart(e, deal)}
                    onClick={() => navigate(`/pipeline/${deal.id}`)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <h4>{deal.title}</h4>
                      <button className="btn-icon" style={{ padding: 2 }} onClick={e => { e.stopPropagation(); handleDelete(deal.id) }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {deal.value > 0 && <p className="deal-value">{formatCurrency(deal.value)}</p>}
                    <span className={`badge badge-${deal.status}`}>{deal.status}</span>
                    {deal.contact_id && (
                      <div className="deal-contact" style={{ marginTop: 6 }}>
                        <span className="mini-avatar">{getInitials(getContactName(deal.contact_id))}</span>
                        {getContactName(deal.contact_id)}
                      </div>
                    )}
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 12, padding: 20 }}>
                    Arraste deals aqui
                  </div>
                )}
              </div>
              <div className="kanban-column-footer">Total: {formatCurrency(total)}</div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Novo Negócio</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Título</label>
                <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Etapa</label>
                <select value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value})}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="novo">Novo</option>
                  <option value="contato">Contato</option>
                  <option value="proposta">Proposta</option>
                  <option value="negociação">Negociação</option>
                  <option value="ganho">Ganho</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contato</label>
                <select value={formData.contact_id} onChange={e => setFormData({...formData, contact_id: e.target.value})}>
                  <option value="">Nenhum</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Empresa</label>
                <select value={formData.company_id} onChange={e => setFormData({...formData, company_id: e.target.value})}>
                  <option value="">Nenhuma</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Deals
