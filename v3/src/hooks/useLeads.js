import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

let leadsCache = null
let leadsCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useLeads() {
  const { authFetch } = useAuth()
  const [leads, setLeads] = useState(() => leadsCache || [])
  const [loading, setLoading] = useState(() => !leadsCache)
  const [error, setError] = useState(null)

  const fetchLeads = useCallback(async (forceRefresh = false, signal, silent = false) => {
    if (forceRefresh) {
      leadsCache = null
      leadsCacheTime = 0
    }
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const url = forceRefresh ? '/api/leads?refresh=true' : '/api/leads'
      const res = await authFetch(url, { signal })
      const data = await res.json()
      const freshLeads = data.leads || []
      leadsCache = freshLeads
      leadsCacheTime = Date.now()
      setLeads(freshLeads)
    } catch (err) {
      if (err.name === 'AbortError') return
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    const controller = new AbortController()
    if (leadsCache) {
      // Stale-while-revalidate: show cached leads instantly, no spinner
      setLeads(leadsCache)
      setLoading(false)
      const isFresh = Date.now() - leadsCacheTime < CACHE_TTL
      if (!isFresh) {
        fetchLeads(false, controller.signal, true)
      }
    } else {
      fetchLeads(false, controller.signal, false)
    }
    return () => controller.abort()
  }, [fetchLeads])

  return { leads, loading, error, refetch: () => fetchLeads(true, undefined, false) }
}
