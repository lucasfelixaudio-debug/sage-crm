import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './AIChatPanel.css'

const QUICK_SUGGESTIONS = [
  'Resumir pipeline',
  'Tarefas pendentes',
  'Contatos sem atividade',
  'Criar novo lead',
]

function AIChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    try {
      localStorage.setItem('sagecrm_ai_history', JSON.stringify(messages.slice(-50)))
    } catch {}
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const token = localStorage.getItem('sagecrm_token')
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: newMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                aiText += `\n\n❌ Erro: ${parsed.error}`
              } else {
                aiText += parsed.text
              }
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: aiText }
                return updated
              })
            } catch {}
          }
        }
      }

      // Check for action blocks
      const actionMatch = aiText.match(/\[ACTION\]\s*({[\s\S]*?})\s*\[\/ACTION\]/)
      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1])
          setPendingAction(action)
        } catch {}
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erro ao conectar com a IA. Verifique se o backend está rodando e a chave API está configurada.' }])
    }
    setLoading(false)
  }

  const executeAction = async () => {
    if (!pendingAction) return
    try {
      const res = await axios.post('/api/ai/action', pendingAction)
      if (res.data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **${pendingAction.action.replace('_', ' ')}** criado com sucesso! (ID: ${res.data.id})`
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Erro ao executar ação: ${err.response?.data?.detail || err.message}`
      }])
    }
    setPendingAction(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearHistory = () => {
    setMessages([])
    localStorage.removeItem('sagecrm_ai_history')
  }

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(!open)} title="Assistente IA">
        <span className="ai-fab-icon">{open ? '✕' : '🤖'}</span>
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-header">
            <div className="ai-header-left">
              <div className="ai-avatar">IA</div>
              <div>
                <div className="ai-title">Assistente IA</div>
                <div className="ai-subtitle">Powered by Claude</div>
              </div>
            </div>
            <button className="ai-clear-btn" onClick={clearHistory} title="Limpar histórico">🗑</button>
          </div>

          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-empty">
                <div className="ai-empty-icon">🤖</div>
                <p>Olá! Sou o assistente do SageCRM.</p>
                <p>Pergunte qualquer coisa sobre seus dados:</p>
                <div className="ai-suggestions">
                  {QUICK_SUGGESTIONS.map(s => (
                    <button key={s} className="ai-suggestion" onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ${msg.role}`}>
                {msg.role === 'assistant' && <div className="ai-msg-avatar">IA</div>}
                <div className="ai-msg-bubble">
                  {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg assistant">
                <div className="ai-msg-avatar">IA</div>
                <div className="ai-msg-bubble ai-typing">
                  <span className="ai-dot"></span>
                  <span className="ai-dot"></span>
                  <span className="ai-dot"></span>
                </div>
              </div>
            )}
            {pendingAction && (
              <div className="ai-action-card">
                <div className="ai-action-title">⚡ Ação sugerida: <strong>{pendingAction.action.replace(/_/g, ' ')}</strong></div>
                <pre className="ai-action-data">{JSON.stringify(pendingAction.data, null, 2)}</pre>
                <div className="ai-action-btns">
                  <button className="ai-action-confirm" onClick={executeAction}>✓ Confirmar</button>
                  <button className="ai-action-cancel" onClick={() => setPendingAction(null)}>✕ Cancelar</button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area">
            <textarea
              ref={inputRef}
              className="ai-input"
              rows={1}
              placeholder="Pergunte algo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button className="ai-send" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default AIChatPanel
