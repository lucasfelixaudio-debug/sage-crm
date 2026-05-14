import { useState, useEffect } from 'react'
import axios from 'axios'
import { MessageCircle, RefreshCw, Send, Settings } from 'lucide-react'

function WhatsApp() {
  const [configured, setConfigured] = useState(null) // null = loading
  const [qrcode, setQrcode] = useState(null)
  const [status, setStatus] = useState('unknown')
  const [messages, setMessages] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [sendNumber, setSendNumber] = useState('')
  const [sendText, setSendText] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('config')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    checkStatus()
    axios.get('/api/contacts').then(r => setContacts(r.data)).catch(() => {})
    loadMessages()
  }, [])

  function loadMessages() {
    axios.get('/api/activities?type=whatsapp').then(r => {
      setMessages(r.data.filter(a => a.type === 'whatsapp'))
    }).catch(() => {})
  }

  async function checkStatus() {
    try {
      const res = await axios.get('/api/whatsapp/status')
      const data = res.data
      setConfigured(data.configured !== false)
      setStatus(data.status || 'unknown')
    } catch {
      setConfigured(false)
      setStatus('error')
    }
  }

  async function connect() {
    if (!configured) return
    setLoading(true)
    try {
      const res = await axios.post('/api/whatsapp/connect')
      setQrcode(res.data.qrcode)
      setStatus(res.data.status || 'connecting')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao conectar')
    }
    setLoading(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    try {
      await axios.post('/api/whatsapp/send', { number: sendNumber, text: sendText })
      setSendText('')
      alert('Mensagem enviada!')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao enviar')
    }
  }

  // Not configured — friendly empty state
  if (configured === false) {
    return (
      <div className="page">
        <div className="page-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageCircle size={24} style={{ color: '#25D366' }} /> WhatsApp
          </h2>
        </div>
        <div className="detail-section" style={{ maxWidth: 520, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <h3 style={{ marginBottom: 8 }}>WhatsApp ainda não configurado</h3>
          <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>
            Para usar o WhatsApp no SageCRM, você precisa configurar a Evolution API.
          </p>
          <button className="btn-secondary" onClick={() => setShowHelp(!showHelp)}>
            {showHelp ? 'Fechar instruções' : 'Como configurar?'}
          </button>
          {showHelp && (
            <div style={{ marginTop: 20, textAlign: 'left', background: 'var(--bg)', padding: 16, borderRadius: 8 }}>
              <p style={{ fontSize: 13, marginBottom: 10 }}><strong>1.</strong> Instale a Evolution API (self-hosted)</p>
              <p style={{ fontSize: 13, marginBottom: 10 }}><strong>2.</strong> Adicione as variáveis no arquivo <code>backend/.env</code>:</p>
              <pre style={{ background: '#0f0f1a', color: '#d4d4ec', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto', marginBottom: 10 }}>
{`EVOLUTION_API_URL=http://sua-url:8080
EVOLUTION_API_KEY=sua-api-key`}
              </pre>
              <p style={{ fontSize: 13 }}><strong>3.</strong> Reinicie o backend e volte aqui para conectar.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Group messages by contact
  const conversations = {}
  messages.forEach(m => {
    const key = m.contact_id || m.title
    if (!conversations[key]) conversations[key] = { contact_id: m.contact_id, title: m.title, messages: [] }
    conversations[key].messages.push(m)
  })

  const contactConvos = Object.values(conversations).filter(c => c.contact_id)
  const getContactName = (id) => contacts.find(c => c.id === id)?.name || 'Desconhecido'

  return (
    <div className="page">
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCircle size={24} style={{ color: '#25D366' }} /> WhatsApp
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn-secondary ${tab === 'config' ? 'active-tab' : ''}`} onClick={() => setTab('config')}>Configuração</button>
          <button className={`btn-secondary ${tab === 'conversations' ? 'active-tab' : ''}`} onClick={() => setTab('conversations')}>Conversas</button>
          <button className={`btn-secondary ${tab === 'send' ? 'active-tab' : ''}`} onClick={() => setTab('send')}>Enviar</button>
        </div>
      </div>

      {tab === 'config' && (
        <div className="wa-grid">
          <div className="wa-config">
            <div className="detail-section">
              <h3>Configuração Evolution API</h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>
                Configure a URL e API Key da sua instância Evolution API no arquivo <code>backend/.env</code>:
              </p>
              <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, marginBottom: 16 }}>
                EVOLUTION_API_URL=http://sua-url:8080<br />
                EVOLUTION_API_KEY=sua-api-key
              </div>
              <div className="wa-status-row">
                <span>Status:</span>
                <span className={`wa-status-dot ${status === 'open' || status === 'CONNECTED' ? 'connected' : 'disconnected'}`}></span>
                <span>{status}</span>
                <button className="btn-icon" onClick={checkStatus} title="Verificar"><RefreshCw size={16} /></button>
              </div>
              <button className="btn-primary" onClick={connect} disabled={loading} style={{ marginTop: 16 }}>
                {loading ? 'Conectando...' : 'Conectar / Gerar QR Code'}
              </button>
            </div>
          </div>
          {qrcode && (
            <div className="wa-qrcode">
              <div className="detail-section" style={{ textAlign: 'center' }}>
                <h3>Escaneie o QR Code</h3>
                <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>Abra o WhatsApp → Aparelhos conectados → Conectar</p>
                {qrcode && <img src={`data:image/png;base64,${qrcode}`} alt="QR Code" style={{ maxWidth: 300, borderRadius: 8 }} />}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'conversations' && (
        <div className="wa-chat-layout">
          <div className="wa-contact-list">
            <h3 style={{ marginBottom: 12 }}>Conversas ({contactConvos.length})</h3>
            {contactConvos.length === 0 ? (
              <p className="empty-state">Nenhuma conversa recebida</p>
            ) : contactConvos.map(c => (
              <div key={c.contact_id} className={`wa-contact-item ${selectedContact === c.contact_id ? 'active' : ''}`}
                onClick={() => { setSelectedContact(c.contact_id); setChatMessages(c.messages) }}>
                <div className="avatar" style={{ background: '#25D366', width: 36, height: 36, fontSize: 14 }}>
                  {getContactName(c.contact_id).charAt(0)}
                </div>
                <div>
                  <strong>{getContactName(c.contact_id)}</strong>
                  <p style={{ fontSize: 12, color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {c.messages[c.messages.length - 1]?.description || c.messages[c.messages.length - 1]?.title}
                  </p>
                </div>
                <span className="wa-badge">{c.messages.length}</span>
              </div>
            ))}
          </div>
          <div className="wa-chat-area">
            {selectedContact ? (
              <>
                <div className="wa-chat-header">
                  <div className="avatar" style={{ background: '#25D366', width: 32, height: 32, fontSize: 13 }}>
                    {getContactName(selectedContact).charAt(0)}
                  </div>
                  <strong>{getContactName(selectedContact)}</strong>
                </div>
                <div className="wa-messages">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`wa-msg received`}>
                      <p>{m.description || m.title}</p>
                      <span className="wa-msg-time">{new Date(m.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ paddingTop: 60 }}>Selecione uma conversa</div>
            )}
          </div>
        </div>
      )}

      {tab === 'send' && (
        <div className="detail-section" style={{ maxWidth: 500 }}>
          <h3>Enviar Mensagem</h3>
          <form onSubmit={sendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="Número (ex: 5511999991111)" value={sendNumber} onChange={e => setSendNumber(e.target.value)} required />
            <textarea placeholder="Mensagem..." value={sendText} onChange={e => setSendText(e.target.value)} rows={4} required />
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Send size={16} /> Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default WhatsApp
