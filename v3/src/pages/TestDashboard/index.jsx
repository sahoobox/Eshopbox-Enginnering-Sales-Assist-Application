import { useState } from 'react'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Loading } from '../../components/ui'

export default function TestDashboard() {
  usePageTitle('Test Dashboard')
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="main" style={{ padding: 0, display: 'flex', position: 'relative' }}>
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
          <Loading text="Loading dashboard…" />
        </div>
      )}
      <iframe
        src="https://crmplus.zoho.com/reports/open-view/3119678000006558021"
        style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
        title="Test Dashboard"
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
