import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export function useTasks() {
  const { authFetch } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/tasks')
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const completeTask = useCallback(async (taskId) => {
    await authFetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: true, status: 'Completed' } : t))
  }, [authFetch])

  const reopenTask = useCallback(async (taskId) => {
    await authFetch(`/api/tasks/${taskId}/reopen`, { method: 'PATCH' })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: false, status: 'Not Started' } : t))
  }, [authFetch])

  const createTask = useCallback(async (taskData) => {
    const res = await authFetch('/api/tasks', { method: 'POST', body: JSON.stringify(taskData) })
    const data = await res.json()
    if (data.success) await fetchTasks()
    return data
  }, [authFetch, fetchTasks])

  return { tasks, loading, error, refetch: fetchTasks, completeTask, reopenTask, createTask }
}
