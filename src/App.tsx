import { Navigate, Route, Routes } from 'react-router-dom'
import IntakeForm from './components/IntakeForm/IntakeForm'
import AuditProgress from './components/AuditProgress/AuditProgress'
import ReportLayout from './components/Report/ReportLayout'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-arctic-50 to-white text-slate-800">
      <Routes>
        <Route path="/" element={<IntakeForm />} />
        <Route path="/audit" element={<AuditProgress />} />
        <Route path="/report" element={<ReportLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
