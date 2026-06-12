import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export function useLeads() {
  const { authFetch } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLeads = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = forceRefresh ? '/api/leads?refresh=true' : '/api/leads'
      const res = await authFetch(url)
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { fetchLeads(false) }, [fetchLeads])

  return { leads, loading, error, refetch: () => fetchLeads(true) }
}
