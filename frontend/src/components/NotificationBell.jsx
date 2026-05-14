import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Bell } from 'lucide-react'

function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const load = () => {
    axios.get('/api/notifications').then(r => setNotifications(r.data)).catch(() => {})
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleClickNotif(n) {
    setOpen(false)
    if (n.type === 'deal' && n.deal_id) navigate(`/pipeline/${n.deal_id}`)
    else if (n.type === 'task') {
      if (n.deal_id) navigate(`/pipeline/${n.deal_id}`)
      else navigate('/tasks')
    }
  }

  const count = notifications.length

  return (
    <div className="notification-bell" ref={ref}>
      <button className="bell-btn" onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {count > 0 && <span className="bell-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">Notificações</div>
          {notifications.length === 0 ? (
            <div className="notification-empty">Nenhuma notificação</div>
          ) : (
            notifications.map((n, i) => (
              <div key={i} className="notification-item" onClick={() => handleClickNotif(n)}>
                <span className={`notification-dot ${n.severity}`}></span>
                <div>
                  <p className="notification-text">{n.message}</p>
                  {n.detail && <p className="notification-detail">{n.detail}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
