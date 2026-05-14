import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

const STAGES = ['prospecção', 'apresentação', 'proposta', 'negociação', 'fechamento']
const STAGE_COLORS = { prospecção: '#3b82f6', 'apresentação': '#f59e0b', proposta: '#8b5cf6', 'negociação': '#ec4899', fechamento: '#10b981' }

function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [activities, setActivities] = useState([])
  const [tasks, setTasks] = useState([])
  const [actForm, setActForm] = useState({ type: 'note', description: '' })

  useEffect(() => {
    axios.get(`/api/deals/${id}`).then(r => setDeal(r.data)).catch(() => navigate('/pipeline'))
    axios.get('/api/contacts').then(r => setContacts(r.data))
    axios.get('/api/companies').then(r => setCompanies(r.data))
    axios.get(`/api/activities?deal_id=${id}`).then(r => setActivities(r.data))
    axios.get('/api/tasks').then(r => setTasks(r.data.filter(t => t.deal_id == id)))
  }, [id])

  async function moveStage(direction) {
    const idx = STAGES.indexOf(deal.stage)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= STAGES.length) return
    const newStage = STAGES[newIdx]
    await axios.put(`/api/deals/${id}`, { ...deal, stage: newStage })
    setDeal({ ...deal, stage: newStage })
  }

  async function addActivity(e) {
    e.preventDefault()
    await axios.post('/api/activities', { ...actForm, deal_id: parseInt(id) })
    setActForm({ type: 'note', description: '' })
    axios.get(`/api/activities?deal_id=${id}`).then(r => setActivities(r.data))
  }

  if (!deal) return <div className="page"><p>Carregando...</p></div>

  const contact = contacts.find(c => c.id === deal.contact_id)
  const company = companies.find(c => c.id === deal.company_id)
  const stageIdx = STAGES.indexOf(deal.stage)

  return (
    <div className="page">
      <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} style={{ marginRight: 8 }} /> Voltar
      </button>

      <div className="detail-header">
        <div>
          <h2>{deal.title}</h2>
          <span className={`badge badge-${deal.status}`} style={{ marginTop: 8, display: 'inline-block' }}>{deal.status}</span>
        </div>
        <div className="deal-value-large">
          R$ {(deal.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="stage-nav">
        <button className="btn-icon" onClick={() => moveStage(-1)} disabled={stageIdx === 0}>
          <ChevronLeft size={20} />
        </button>
        <div className="stage-progress">
          {STAGES.map((s, i) => (
            <div key={s} className={`stage-step ${i <= stageIdx ? 'active' : ''}`} style={{ '--step-color': STAGE_COLORS[s] }}>
              <div className="stage-dot"></div>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <button className="btn-icon" onClick={() => moveStage(1)} disabled={stageIdx === STAGES.length - 1}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="detail-info" style={{ marginBottom: 20 }}>
        {contact && <div className="info-item">Contato: <Link to={`/contacts/${contact.id}`} style={{ color: 'var(--primary)' }}>{contact.name}</Link></div>}
        {company && <div className="info-item">Empresa: {company.name}</div>}
        {deal.created_at && <div className="info-item">Criado em: {new Date(deal.created_at).toLocaleDateString('pt-BR')}</div>}
      </div>

      <div className="detail-grid">
        <div className="detail-section">
          <h3>Tarefas ({tasks.length})</h3>
          {tasks.length === 0 ? (
            <p className="empty-state">Nenhuma tarefa vinculada</p>
          ) : tasks.map(t => (
            <div key={t.id} className={`task-mini-card ${t.completed ? 'done' : ''}`}>
              <span>{t.completed ? '✓' : '○'}</span>
              <span>{t.title}</span>
            </div>
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
              placeholder="Descrição..."
              required
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}><Plus size={14} /></button>
          </form>
          <div className="timeline">
            {activities.length === 0 ? (
              <p className="empty-state">Nenhuma atividade</p>
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
    </div>
  )
}

export default DealDetail
