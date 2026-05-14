import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, CheckCircle2, Circle, Clock, Calendar } from 'lucide-react'

function Tasks() {
  const [tasks, setTasks] = useState([])
  const [contacts, setContacts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', due_date: '', contact_id: '', deal_id: '' })

  const load = () => {
    Promise.all([
      axios.get('/api/tasks').then(r => r.data),
      axios.get('/api/contacts').then(r => r.data),
    ]).then(([t, c]) => { setTasks(t); setContacts(c) })
      .catch(console.error)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await axios.post('/api/tasks', {
      ...formData,
      due_date: formData.due_date || null,
      contact_id: formData.contact_id ? parseInt(formData.contact_id) : null,
      deal_id: formData.deal_id ? parseInt(formData.deal_id) : null,
    })
    setFormData({ title: '', description: '', due_date: '', contact_id: '', deal_id: '' })
    setShowForm(false)
    load()
  }

  async function toggleComplete(task) {
    await axios.put(`/api/tasks/${task.id}`, { ...task, completed: !task.completed })
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir esta tarefa?')) return
    await axios.delete(`/api/tasks/${id}`)
    load()
  }

  const getContactName = (id) => contacts.find(c => c.id === id)?.name || ''

  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  return (
    <div className="page">
      <div className="page-header">
        <h2>Tarefas</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Nova Tarefa</button>
      </div>

      {showForm && (
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <input type="text" placeholder="Título *" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
            <textarea placeholder="Descrição" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            <div className="form-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} style={{ color: 'var(--text-light)' }} />
                <input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
              </div>
              <select value={formData.contact_id} onChange={e => setFormData({...formData, contact_id: e.target.value})}>
                <option value="">Sem contato</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-buttons">
              <button type="submit" className="btn-primary">Criar</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h3 style={{ marginBottom: 12, color: 'var(--text)', fontSize: 16 }}>Pendentes ({pending.length})</h3>
          <div className="list" style={{ marginBottom: 30 }}>
            {pending.map(t => (
              <div key={t.id} className="list-item">
                <button onClick={() => toggleComplete(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                  <Circle size={22} />
                </button>
                <div className="item-info">
                  <h3>{t.title}</h3>
                  {t.description && <p>{t.description}</p>}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                    {t.due_date && <span><Clock size={12} style={{marginRight: 4}} />{new Date(t.due_date).toLocaleDateString('pt-BR')}</span>}
                    {t.contact_id && <span>{getContactName(t.contact_id)}</span>}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
                {t.due_date && (
                  <button className="btn-icon" title="Sync Google Calendar" onClick={async () => {
                    try {
                      await axios.post('/api/calendar/sync-task', { title: t.title, description: t.description || '', due_date: new Date(t.due_date).toISOString() })
                      alert('Evento criado no Google Calendar!')
                    } catch (err) {
                      alert(err.response?.data?.detail || 'Conecte o Google Calendar primeiro')
                    }
                  }}><Calendar size={14} style={{ color: '#4285F4' }} /></button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <h3 style={{ marginBottom: 12, color: 'var(--text-light)', fontSize: 16 }}>Concluídas ({completed.length})</h3>
          <div className="list">
            {completed.map(t => (
              <div key={t.id} className="list-item" style={{ opacity: 0.6 }}>
                <button onClick={() => toggleComplete(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}>
                  <CheckCircle2 size={22} />
                </button>
                <div className="item-info">
                  <h3 style={{ textDecoration: 'line-through' }}>{t.title}</h3>
                  {t.description && <p>{t.description}</p>}
                </div>
                <button className="btn-icon" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tasks.length === 0 && <p className="empty-state">Nenhuma tarefa. Crie uma nova!</p>}
    </div>
  )
}

export default Tasks
