import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export function useDeals() {
  const { authFetch } = useAuth()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/deals')
      const data = await res.json()
      setDeals(data.deals || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  return { deals, loading, error, refetch: fetchDeals }
}

export function useDeal(dealId) {
  const { authFetch } = useAuth()
  const [deal, setDeal] = useState(null)
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!dealId) return
    setLoading(true)
    Promise.all([
      authFetch(`/api/deals/${dealId}`).then(r => r.json()),
      authFetch(`/api/deals/${dealId}/emails`).then(r => r.json()),
    ])
      .then(([dealData, emailData]) => {
        setDeal(dealData)
        setEmails(emailData.emails || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [dealId, authFetch])

  return { deal, emails, loading, error }
}
