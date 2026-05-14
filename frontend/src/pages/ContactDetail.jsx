import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Mail, Phone, Building2, Plus, Send } from 'lucide-react'

function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [companies, setCompanies] = useState([])
  const [deals, setDeals] = useState([])
  const [activities, setActivities] = useState([])
  const [actForm, setActForm] = useState({ type: 'note', description: '' })
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' })
  const [emailSending, setEmailSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})

  function load() {
    axios.get(`/api/contacts/${id}`).then(r => { setContact(r.data); setEditData(r.data) }).catch(() => navigate('/contacts'))
    axios.get('/api/companies').then(r => setCompanies(r.data))
    axios.get(`/api/activities?contact_id=${id}`).then(r => setActivities(r.data))
    axios.get('/api/deals').then(r => setDeals(r.data.filter(d => d.contact_id == id)))
  }

  useEffect(() => { load() }, [id])

  async function addActivity(e) {
    e.preventDefault()
    await axios.post('/api/activities', { ...actForm, contact_id: parseInt(id) })
    setActForm({ type: 'note', description: '' })
    axios.get(`/api/activities?contact_id=${id}`).then(r => setActivities(r.data))
  }

  async function saveContact() {
    await axios.put(`/api/contacts/${id}`, editData)
    setContact({ ...editData })
    setEditing(false)
  }

  if (!contact) return <div className="page"><p>Carregando...</p></div>

  const getCompanyName = (cid) => companies.find(c => c.id === cid)?.name || '—'
  const initials = contact.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className="page">
      <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} style={{ marginRight: 8 }} /> Voltar
      </button>

      <div className="detail-header">
        <div className="detail-avatar" style={{ background: '#3b82f6' }}>{initials}</div>
        <div className="detail-title">
          <h2>{contact.name}</h2>
          <p>{getCompanyName(contact.company_id)}</p>
        </div>
        <button className="btn-secondary" onClick={() => setEditing(!editing)}>
          {editing ? 'Cancelar' : 'Editar'}
        </button>
        {contact.email && (
          <button className="btn-primary" onClick={() => setShowEmailModal(true)} style={{ padding: '8px 14px' }}>
            <Send size={14} /> Enviar Email
          </button>
        )}
      </div>

      {editing ? (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <form onSubmit={e => { e.preventDefault(); saveContact() }}>
            <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Nome" />
            <div className="form-row">
              <input value={editData.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })} placeholder="Email" />
              <input value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} placeholder="Telefone" />
            </div>
            <select value={editData.company_id || ''} onChange={e => setEditData({ ...editData, company_id: e.target.value ? parseInt(e.target.value) : null })}>
              <option value="">Sem empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="form-buttons">
              <button type="submit" className="btn-primary">Salvar</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="detail-info" style={{ marginBottom: 20 }}>
          <div className="info-item"><Mail size={16} /> <span>{contact.email || '—'}</span></div>
          <div className="info-item"><Phone size={16} /> <span>{contact.phone || '—'}</span></div>
          <div className="info-item"><Building2 size={16} /> <span>{getCompanyName(contact.company_id)}</span></div>
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-section">
          <h3>Deals ({deals.length})</h3>
          {deals.length === 0 ? (
            <p className="empty-state">Nenhum deal vinculado</p>
          ) : deals.map(d => (
            <Link to={`/pipeline/${d.id}`} key={d.id} className="deal-mini-card">
              <strong>{d.title}</strong>
              <span className={`badge badge-${d.status}`}>{d.status}</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>R$ {(d.value || 0).toLocaleString('pt-BR')}</span>
            </Link>
          ))}
        </div>

        <div className="detail-section">
          <h3>Atividades ({activities.length})</h3>
          <form className="inline-form" onSubmit={addActivity}>
            <select value={actForm.type} onChange={e => setActForm({ ...actForm, type: e.target.value })}>
              <option value="note">Nota</option>
              <option value="call">Ligação</option>
              <option value="email">Email</option>
              <option value="meeting">Reunião</option>
            </select>
            <input
              value={actForm.description}
              onChange={e => setActForm({ ...actForm, description: e.target.value })}
              placeholder="Descrição da atividade..."
              required
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}><Plus size={14} /></button>
          </form>
          <div className="timeline">
            {activities.length === 0 ? (
              <p className="empty-state">Nenhuma atividade registrada</p>
            ) : activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(a => (
              <div key={a.id} className="timeline-item">
                <span className={`timeline-dot type-${a.type}`}></span>
                <div className="timeline-content">
                  <strong>{a.type}</strong>
                  <p>{a.description || a.title}</p>
                  <span className="timeline-date">{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Enviar Email para {contact.name}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setEmailSending(true)
              try {
                await axios.post('/api/email/send', { to: contact.email, subject: emailForm.subject, body: emailForm.body, contact_id: contact.id })
                setShowEmailModal(false)
                setEmailForm({ subject: '', body: '' })
                load()
                alert('Email enviado!')
              } catch (err) {
                alert(err.response?.data?.detail || 'Erro ao enviar email')
              }
              setEmailSending(false)
            }}>
              <div className="form-group">
                <label>Para</label>
                <input value={contact.email} disabled />
              </div>
              <div className="form-group">
                <label>Assunto</label>
                <input value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Corpo</label>
                <textarea rows={6} value={emailForm.body} onChange={e => setEmailForm({ ...emailForm, body: e.target.value })} placeholder="Escreva sua mensagem..." required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowEmailModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={emailSending}>{emailSending ? 'Enviando...' : 'Enviar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactDetail
