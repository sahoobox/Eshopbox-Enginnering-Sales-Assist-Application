import { usePageTitle } from '../../hooks/usePageTitle'

export default function CentralDashboard() {
  usePageTitle('Central Dashboard')

  return (
    <div className="main" style={{ padding: 0, display: 'flex' }}>
      <iframe
        src="https://crmplus.zoho.com/reports/open-view/3119678000005933745"
        style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
        title="Central Dashboard"
      />
    </div>
  )
}
