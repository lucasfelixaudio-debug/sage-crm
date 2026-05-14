import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, Percent, Activity } from 'lucide-react'

function Reports() {
  const [summary, setSummary] = useState({})
  const [pipeline, setPipeline] = useState([])
  const [revenue, setRevenue] = useState([])
  const [topContacts, setTopContacts] = useState([])
  const [conversion, setConversion] = useState({})

  useEffect(() => {
    axios.get('/api/reports/summary').then(r => setSummary(r.data)).catch(() => {})
    axios.get('/api/reports/pipeline').then(r => setPipeline(r.data)).catch(() => {})
    axios.get('/api/reports/revenue').then(r => setRevenue(r.data)).catch(() => {})
    axios.get('/api/reports/top-contacts').then(r => setTopContacts(r.data)).catch(() => {})
    axios.get('/api/reports/conversion').then(r => setConversion(r.data)).catch(() => {})
  }, [])

  const kpis = [
    { label: 'Total Ganho', value: `R$ ${(summary.total_won || 0).toLocaleString('pt-BR')}`, icon: DollarSign, color: '#10b981' },
    { label: 'Ticket Médio', value: `R$ ${(summary.avg_ticket || 0).toLocaleString('pt-BR')}`, icon: TrendingUp, color: '#3b82f6' },
    { label: 'Conversão', value: `${conversion.rate || 0}%`, icon: Percent, color: '#f59e0b' },
    { label: 'Deals Ativos', value: summary.active_deals || 0, icon: Activity, color: '#8b5cf6' },
  ]

  return (
    <div className="page">
      <h2 style={{ marginBottom: 30 }}>Relatórios</h2>

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

      <div className="reports-charts">
        <div className="chart-card">
          <h3>Deals por Estágio</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={v => `R$ ${v.toLocaleString('pt-BR')}`} />
              <Bar dataKey="value" fill="#3b82f6" name="Valor" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Receita por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={v => `R$ ${v.toLocaleString('pt-BR')}`} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Receita" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: 20 }}>
        <h3>Top Contatos</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Deals</th>
              <th>Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {topContacts.length === 0 ? (
              <tr><td colSpan={3} className="empty-state">Nenhum dado</td></tr>
            ) : topContacts.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.deals_count}</td>
                <td>R$ {c.deals_value.toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Reports
