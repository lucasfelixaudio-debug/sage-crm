import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Search, Users, DollarSign, Building2, CheckSquare } from 'lucide-react'

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (query.length >= 3) {
      const timer = setTimeout(() => {
        axios.get(`/api/search?q=${encodeURIComponent(query)}`)
          .then(r => { setResults(r.data); setOpen(true) })
          .catch(() => {})
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setResults(null)
      setOpen(false)
    }
  }, [query])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function goTo(category, id) {
    setOpen(false)
    setQuery('')
    if (category === 'contacts') navigate(`/contacts/${id}`)
    else if (category === 'deals') navigate(`/pipeline/${id}`)
    else if (category === 'companies') navigate('/companies')
    else if (category === 'tasks') navigate('/tasks')
  }

  const categories = [
    { key: 'contacts', label: 'Contatos', icon: Users },
    { key: 'deals', label: 'Deals', icon: DollarSign },
    { key: 'companies', label: 'Empresas', icon: Building2 },
    { key: 'tasks', label: 'Tarefas', icon: CheckSquare },
  ]

  const hasResults = results && Object.values(results).some(arr => arr?.length > 0)

  return (
    <div className="global-search" ref={ref}>
      <div className="search-input-wrapper">
        <Search size={16} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
        />
      </div>
      {open && hasResults && (
        <div className="search-dropdown">
          {categories.map(({ key, label, icon: Icon }) => {
            const items = results[key] || []
            if (items.length === 0) return null
            return (
              <div key={key} className="search-category">
                <div className="search-category-header"><Icon size={14} /> {label}</div>
                {items.map(item => (
                  <div key={item.id} className="search-item" onClick={() => goTo(key, item.id)}>
                    <span className="search-item-name">{item.name || item.title}</span>
                    {item.stage && <span className="badge" style={{ fontSize: 10, padding: '1px 6px' }}>{item.stage}</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default GlobalSearch
