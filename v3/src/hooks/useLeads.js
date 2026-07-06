import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export function useLeads() {
  const { authFetch } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLeads = useCallback(async (forceRefresh = false, signal) => {
    setLoading(true)
    setError(null)
    try {
      const url = forceRefresh ? '/api/leads?refresh=true' : '/api/leads'
      const res = await authFetch(url, { signal })
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    const controller = new AbortController()
    fetchLeads(false, controller.signal)
    return () => controller.abort()
  }, [fetchLeads])

  return { leads, loading, error, refetch: () => fetchLeads(true) }
}
