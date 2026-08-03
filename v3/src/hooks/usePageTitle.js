import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Sales Assist` : 'Sales Assist'
    return () => { document.title = 'Sales Assist' }
  }, [title])
}
