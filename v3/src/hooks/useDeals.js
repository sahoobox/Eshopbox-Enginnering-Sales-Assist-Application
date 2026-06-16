import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export function useDeals() {
  const { authFetch } = useAuth()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDeals = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = forceRefresh ? '/api/deals?refresh=true' : '/api/deals'
      const res = await authFetch(url)
      const data = await res.json()
      setDeals(data.deals || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { fetchDeals(false) }, [fetchDeals])

  return { deals, loading, error, refetch: () => fetchDeals(true) }
}

export function useDeal(dealId) {
  const { authFetch } = useAuth()
  const [deal, setDeal] = useState(null)
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDeal = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    Promise.all([
      authFetch(`/api/deals/${dealId}`).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.error || `Failed to load deal (${r.status})`)
        }
        return r.json()
      }),
      authFetch(`/api/deals/${dealId}/emails`).then(r => r.json()),
    ])
      .then(([dealData, emailData]) => {
        setDeal(dealData)
        setEmails(emailData.emails || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [dealId, authFetch])

  useEffect(() => { fetchDeal() }, [fetchDeal])

  return { deal, emails, loading, error, refetch: fetchDeal }
}
