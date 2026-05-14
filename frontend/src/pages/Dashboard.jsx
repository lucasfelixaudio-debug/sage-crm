import { useState, useEffect } from 'react'
import axios from 'axios'
import { Users, DollarSign, CheckSquare, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function Dashboard() {
  const [dashboard, setDashboard] = useState({})
  const [reports, setReports] = useState({})
  const [pipeline, setPipeline] = useState([])
  const [todayTasks, setTodayTasks] = useState([])
  const [recentActivities, setRecentActivities] = useState([])
  const [staleDeals, setStaleDeals] = useState([])

  useEffect(() => {
    axios.get('/api/dashboard').then(r => setDashboard(r.data)).catch(() => {})
    axios.get('/api/reports/summary').then(r => setReports(r.data)).catch(() => {})
    axios.get('/api/reports/pipeline').then(r => setPipeline(r.data)).catch(() => {})
    axios.get('/api/notifications').then(r => {
      setStaleDeals(r.data.filter(n => n.type === 'deal'))
    }).catch(() => {})
    axios.get('/api/tasks').then(r => {
      const today = new Date().toISOString().split('T')[0]
      setTodayTasks(r.data.filter(t => !t.completed && t.due_date?.split('T')[0] === today).slice(0, 5))
    }).catch(() => {})
    axios.get('/api/activities').then(r => {
      setRecentActivities(r.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5))
    }).catch(() => {})
  }, [])

  const kpis = [
    { label: 'Deals Ativos', value: reports.active_deals || dashboard.total_deals || 0, icon: DollarSign, color: '#3b82f6' },
    { label: 'Total Ganho', value: `R$ ${(reports.total_won || 0).toLocaleString('pt-BR')}`, icon: TrendingUp, color: '#10b981' },
    { label: 'Contatos', value: dashboard.total_contacts || 0, icon: Users, color: '#8b5cf6' },
    { label: 'Tarefas Pendentes', value: dashboard.pending_tasks || 0, icon: CheckSquare, color: '#f59e0b' },
  ]

  return (
    <div className="page">
      <h2 style={{ marginBottom: 30 }}>Dashboard</h2>

      <div className="cards-grid">
        {kpis.map(kpi => (
          <div key={kpi.label} className="card">
            <div className="card-icon" style={{ background: kpi.color + '20', color: kpi.color, fontSize: 24 }}>
              <kpi.icon size={24} />
            </div>
            <div className="card-content">
              <h3>{kpi.label}</h3>
              <p className="card-value">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>Deals por Estágio</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pipeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" name="Deals" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-side">
          <div className="dashboard-list">
            <h3><Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Tarefas de Hoje</h3>
            {todayTasks.length === 0 ? (
              <p className="empty-state" style={{ padding: 10 }}>Nenhuma tarefa para hoje</p>
            ) : todayTasks.map(t => (
              <div key={t.id} className="dashboard-list-item">
                <span>{t.title}</span>
              </div>
            ))}
          </div>

          <div className="dashboard-list">
            <h3>Últimas Atividades</h3>
            {recentActivities.length === 0 ? (
              <p className="empty-state" style={{ padding: 10 }}>Nenhuma atividade</p>
            ) : recentActivities.map(a => (
              <div key={a.id} className="dashboard-list-item">
                <span className={`timeline-dot type-${a.type}`} style={{ width: 8, height: 8, minWidth: 8 }}></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description || a.title || a.type}</span>
              </div>
            ))}
          </div>

          {staleDeals.length > 0 && (
            <div className="dashboard-list alert">
              <h3><AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />Deals sem atividade</h3>
              {staleDeals.slice(0, 5).map((d, i) => (
                <div key={i} className="dashboard-list-item">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
