import { useState, useEffect } from 'react'
import axios from 'axios'
import { MessageCircle, Mail, Calendar, Webhook, Plus, Trash2, Copy, ExternalLink, X } from 'lucide-react'

const BADGE_STYLES = {
  connected:  { bg: '#10b981', label: 'Conectado' },
  configured: { bg: '#6b7280', label: 'Não conectado' },
  not_configured: { bg: '#374151', label: 'Não configurado' },
  error:      { bg: '#ef4444', label: 'Erro' },
}

function StatusBadge({ state }) {
  const s = BADGE_STYLES[state] || BADGE_STYLES.not_configured
  return (
    <span style={{
      background: s.bg + '20', color: s.bg, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function Integrations() {
  const [webhooks, setWebhooks] = useState([])
  const [webhookForm, setWebhookForm] = useState({ url: '', event: 'contact_created' })
  const [intStates, setIntStates] = useState({
    whatsapp: 'not_configured',
    email: 'not_configured',
    calendar: 'not_configured',
    webhooks: 'not_configured',
  })
  const [copied, setCopied] = useState(false)
  const [helpModal, setHelpModal] = useState(null) // null | 'whatsapp' | 'calendar'

  useEffect(() => {
    // WhatsApp
    axios.get('/api/whatsapp/status')
      .then(r => {
        const d = r.data
        if (d.configured === false) setIntStates(s => ({ ...s, whatsapp: 'not_configured' }))
        else if (d.status === 'open' || d.status === 'CONNECTED') setIntStates(s => ({ ...s, whatsapp: 'connected' }))
        else setIntStates(s => ({ ...s, whatsapp: 'configured' }))
      })
      .catch(() => setIntStates(s => ({ ...s, whatsapp: 'error' })))

    // Email
    axios.get('/api/email/config')
      .then(r => {
        setIntStates(s => ({ ...s, email: r.data.configured ? 'connected' : 'not_configured' }))
      })
      .catch(() => setIntStates(s => ({ ...s, email: 'error' })))

    // Calendar
    axios.get('/api/calendar/status')
      .then(r => {
        const d = r.data
        if (d.configured === false) setIntStates(s => ({ ...s, calendar: 'not_configured' }))
        else if (d.connected) setIntStates(s => ({ ...s, calendar: 'connected' }))
        else setIntStates(s => ({ ...s, calendar: 'configured' }))
      })
      .catch(() => setIntStates(s => ({ ...s, calendar: 'error' })))

    // Webhooks
    axios.get('/api/webhooks')
      .then(r => setWebhooks(r.data))
      .catch(() => {})
  }, [])

  // Derive webhooks state from data
  useEffect(() => {
    if (webhooks.length > 0) setIntStates(s => ({ ...s, webhooks: 'connected' }))
  }, [webhooks])

  async function addWebhook(e) {
    e.preventDefault()
    try {
      await axios.post('/api/webhooks', webhookForm)
      setWebhookForm({ url: '', event: 'contact_created' })
      const r = await axios.get('/api/webhooks')
      setWebhooks(r.data)
    } catch (err) {
      alert('Erro ao criar webhook')
    }
  }

  async function deleteWebhook(id) {
    if (!window.confirm('Remover webhook?')) return
    await axios.delete(`/api/webhooks/${id}`)
    const r = await axios.get('/api/webhooks')
    setWebhooks(r.data)
  }

  function copyUrl() {
    navigator.clipboard.writeText(window.location.origin + '/api/webhooks/inbound')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function connectCalendar() {
    try {
      const res = await axios.get('/api/calendar/auth')
      window.open(res.data.url, '_blank')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao conectar Google Calendar')
    }
  }

  const integrations = [
    {
      key: 'whatsapp',
      name: 'WhatsApp',
      icon: MessageCircle,
      color: '#25D366',
      description: 'Conecte via Evolution API para enviar e receber mensagens',
      state: intStates.whatsapp,
      link: '/whatsapp',
      help: {
        title: 'Configurar WhatsApp',
        steps: [
          'Instale a Evolution API em um servidor',
          'Adicione no arquivo backend/.env:',
          'EVOLUTION_API_URL=http://sua-url:8080\nEVOLUTION_API_KEY=sua-api-key',
          'Reinicie o backend e conecte na página do WhatsApp',
        ],
      },
    },
    {
      key: 'email',
      icon: Mail,
      name: 'Email (SMTP)',
      color: '#3b82f6',
      description: 'Envie emails direto do CRM via Gmail ou Outlook',
      state: intStates.email,
      link: '/email-settings',
      help: {
        title: 'Configurar Email',
        steps: [
          'Vá em Email no menu lateral',
          'Preencha servidor SMTP, porta, email e senha',
          'Para Gmail, use senha de app (não a senha normal)',
          'Clique em "Salvar" e depois "Testar conexão"',
        ],
      },
    },
    {
      key: 'calendar',
      icon: Calendar,
      name: 'Google Calendar',
      color: '#4285F4',
      description: 'Sincronize tarefas com o Google Calendar',
      state: intStates.calendar,
      action: intStates.calendar === 'configured' ? 'connect-calendar' : null,
      help: {
        title: 'Configurar Google Calendar',
        steps: [
          'Crie um projeto no Google Cloud Console',
          'Ative a Google Calendar API',
          'Crie credenciais OAuth 2.0',
          'Adicione no arquivo backend/.env:',
          'GOOGLE_CLIENT_ID=seu-client-id\nGOOGLE_CLIENT_SECRET=seu-client-secret',
          'Reinicie o backend e clique em "Conectar Google"',
        ],
      },
    },
    {
      key: 'webhooks',
      icon: Webhook,
      name: 'Webhooks',
      color: '#8b5cf6',
      description: 'Integre com sistemas externos via webhooks',
      state: intStates.webhooks,
      help: {
        title: 'Configurar Webhooks',
        steps: [
          'Use o formulário abaixo para adicionar webhooks de saída',
          'Eventos disponíveis: contato criado, deal atualizado, tarefa criada',
          'O endpoint de entrada recebe leads externos automaticamente',
        ],
      },
    },
  ]

  function cardOpacity(state) {
    if (state === 'not_configured') return 0.65
    return 1
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Integrações</h2>
      </div>

      <div className="cards-grid" style={{ marginBottom: 30 }}>
        {integrations.map(int => (
          <div key={int.name} className="card" style={{
            flexDirection: 'column', alignItems: 'flex-start', gap: 12,
            opacity: cardOpacity(int.state),
            border: int.state === 'connected' ? '1px solid #10b98140' : int.state === 'error' ? '1px solid #ef444440' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={{ background: int.color + '20', color: int.color, width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <int.icon size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>{int.name}</h3>
                  <StatusBadge state={int.state} />
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>{int.description}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {int.link && (
                <a href={int.link} className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>
                  {int.state === 'not_configured' ? 'Configurar' : 'Gerenciar'}
                </a>
              )}
              {int.action === 'connect-calendar' && (
                <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={connectCalendar}>
                  <ExternalLink size={14} /> Conectar Google
                </button>
              )}
              {int.help && int.state === 'not_configured' && (
                <button className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setHelpModal(int.key)}>
                  Como configurar?
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Webhooks section */}
      <div className="detail-grid">
        <div className="detail-section">
          <h3 style={{ marginBottom: 16 }}>Webhooks de Saída</h3>
          <form className="inline-form" onSubmit={addWebhook}>
            <input value={webhookForm.url} onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder="https://..." required style={{ flex: 2 }} />
            <select value={webhookForm.event} onChange={e => setWebhookForm({ ...webhookForm, event: e.target.value })}>
              <option value="contact_created">Contato criado</option>
              <option value="deal_updated">Deal atualizado</option>
              <option value="task_created">Tarefa criada</option>
            </select>
            <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}><Plus size={14} /></button>
          </form>
          {webhooks.length === 0 ? (
            <p className="empty-state">Nenhum webhook cadastrado</p>
          ) : webhooks.map(w => (
            <div key={w.id} className="list-item" style={{ padding: 10 }}>
              <Webhook size={14} style={{ color: 'var(--text-light)' }} />
              <div className="item-info">
                <p style={{ fontSize: 13 }}>{w.url}</p>
                <span className="badge" style={{ fontSize: 10 }}>{w.event}</span>
              </div>
              <button className="btn-icon" onClick={() => deleteWebhook(w.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h3 style={{ marginBottom: 16 }}>Webhook de Entrada</h3>
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>
            Envie leads externos para esta URL e eles serão criados como contatos automaticamente.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {window.location.origin}/api/webhooks/inbound
            </code>
            <button className="btn-icon" onClick={copyUrl} title="Copiar URL">
              {copied ? <span style={{ color: '#10b981', fontSize: 14 }}>✓</span> : <Copy size={14} />}
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>Exemplo de payload:</p>
            <pre style={{ background: '#0f0f1a', color: '#d4d4ec', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
{`{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "5511999991111",
  "origin": "landing-page"
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Help modal */}
      {helpModal && (() => {
        const int = integrations.find(i => i.key === helpModal)
        if (!int?.help) return null
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }} onClick={() => setHelpModal(null)}>
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%',
              maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3>{int.help.title}</h3>
                <button className="btn-icon" onClick={() => setHelpModal(null)}><X size={18} /></button>
              </div>
              {int.help.steps.map((step, i) => {
                const isCode = step.includes('=') && step.length < 80
                return isCode ? (
                  <pre key={i} style={{ background: '#0f0f1a', color: '#d4d4ec', padding: 10, borderRadius: 6, fontSize: 12, margin: '8px 0', overflow: 'auto' }}>{step}</pre>
                ) : (
                  <p key={i} style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>{step}</p>
                )
              })}
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setHelpModal(null)}>Entendi</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default Integrations
