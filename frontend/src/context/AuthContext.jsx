import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('sagecrm_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      axios.get('/api/auth/me')
        .then(r => {
          setUser(r.data)
          setLoading(false)
        })
        .catch(() => {
          localStorage.removeItem('sagecrm_token')
          setToken(null)
          delete axios.defaults.headers.common['Authorization']
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  function login(newToken, userData) {
    localStorage.setItem('sagecrm_token', newToken)
    setToken(newToken)
    setUser(userData)
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  function logout() {
    localStorage.removeItem('sagecrm_token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
