import { useState, useEffect } from 'react'
import axios from 'axios'
import { Mail, Send, CheckCircle, XCircle } from 'lucide-react'

function EmailSettings() {
  const [config, setConfig] = useState({ smtp_host: 'smtp.gmail.com', smtp_port: 587, email: '', password: '', sender_name: 'SageCRM' })
  const [configured, setConfigured] = useState(false)
  const [sent, setSent] = useState([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    axios.get('/api/email/config').then(r => {
      if (r.data.configured) {
        setConfigured(true)
        setConfig(prev => ({ ...prev, smtp_host: r.data.smtp_host, smtp_port: r.data.smtp_port, email: r.data.email, sender_name: r.data.sender_name }))
      }
    }).catch(() => {})
    axios.get('/api/email/sent').then(r => setSent(r.data)).catch(() => {})
  }, [])

  async function saveConfig(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await axios.post('/api/email/config', config)
      setConfigured(true)
      alert('Configuração salva!')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      await axios.post('/api/email/test')
      setTestResult('ok')
    } catch (err) {
      setTestResult('error')
      alert(err.response?.data?.detail || 'Falha na conexão')
    }
    setTesting(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mail size={24} style={{ color: '#3b82f6' }} /> Email
        </h2>
      </div>

      <div className="email-grid">
        <div className="detail-section">
          <h3>Configuração SMTP</h3>
          <form onSubmit={saveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-row">
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4, display: 'block' }}>Servidor SMTP</label>
                <input value={config.smtp_host} onChange={e => setConfig({ ...config, smtp_host: e.target.value })} placeholder="smtp.gmail.com" required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4, display: 'block' }}>Porta</label>
                <input type="number" value={config.smtp_port} onChange={e => setConfig({ ...config, smtp_port: parseInt(e.target.value) })} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4, display: 'block' }}>Email</label>
              <input type="email" value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} placeholder="seu@email.com" required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4, display: 'block' }}>Senha (App Password)</label>
              <input type="password" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} placeholder="••••••••" required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4, display: 'block' }}>Nome do remetente</label>
              <input value={config.sender_name} onChange={e => setConfig({ ...config, sender_name: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Configuração'}</button>
              {configured && (
                <button type="button" className="btn-secondary" onClick={testConnection} disabled={testing}>
                  {testing ? 'Testando...' : 'Testar Conexão'}
                </button>
              )}
            </div>
            {testResult === 'ok' && <p style={{ color: '#10b981', fontSize: 13 }}><CheckCircle size={14} style={{ verticalAlign: 'middle' }} /> Email de teste enviado com sucesso!</p>}
            {testResult === 'error' && <p style={{ color: '#ef4444', fontSize: 13 }}><XCircle size={14} style={{ verticalAlign: 'middle' }} /> Falha na conexão SMTP</p>}
          </form>
          <div style={{ marginTop: 20, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
              <strong>Gmail:</strong> Use uma App Password (configurações → Segurança → Verificação em 2 etapas → Senhas de app)<br />
              <strong>Outlook:</strong> Use smtp.office365.com:587 com senha normal
            </p>
          </div>
        </div>

        <div className="detail-section">
          <h3>Emails Enviados ({sent.length})</h3>
          {sent.length === 0 ? (
            <p className="empty-state">Nenhum email enviado</p>
          ) : (
            <div className="list">
              {sent.map(e => (
                <div key={e.id} className="list-item" style={{ padding: 10 }}>
                  <Mail size={16} style={{ color: 'var(--text-light)' }} />
                  <div className="item-info">
                    <h4 style={{ fontSize: 13 }}>{e.subject}</h4>
                    <p style={{ fontSize: 12 }}>Para: {e.to}</p>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{e.sent_at ? new Date(e.sent_at).toLocaleString('pt-BR') : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailSettings
