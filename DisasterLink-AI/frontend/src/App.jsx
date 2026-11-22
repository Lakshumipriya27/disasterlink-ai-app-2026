import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import PublicLayout from './components/PublicLayout'
import { Loading } from './components/ui'
import ErrorBoundary from './components/ErrorBoundary'

const Landing = lazy(() => import('./pages/public/Landing'))
const SOS = lazy(() => import('./pages/public/SOS'))
const SubmitRequest = lazy(() => import('./pages/public/SubmitRequest'))
const Communicate = lazy(() => import('./pages/public/Communicate'))
const Track = lazy(() => import('./pages/public/Track'))
const VolunteerRegister = lazy(() => import('./pages/public/VolunteerRegister'))
const SupportRegister = lazy(() => import('./pages/public/SupportRegister'))
const FamilyReport = lazy(() => import('./pages/public/FamilyReport'))
const ShelterFinderPage = lazy(() => import('./pages/public/ShelterFinderPage'))
const Relay = lazy(() => import('./pages/public/Relay'))
const Login = lazy(() => import('./pages/public/Login'))
const NotFound = lazy(() => import('./pages/public/NotFound'))

const CommandCenter = lazy(() => import('./pages/dash/CommandCenter'))
const DisasterMap = lazy(() => import('./pages/dash/DisasterMap'))
const Requests = lazy(() => import('./pages/dash/Requests'))
const SOSMonitoring = lazy(() => import('./pages/dash/SOSMonitoring'))
const Vulnerable = lazy(() => import('./pages/dash/Vulnerable'))
const AIIntelligence = lazy(() => import('./pages/dash/AIIntelligence'))
const Resources = lazy(() => import('./pages/dash/Resources'))
const Matching = lazy(() => import('./pages/dash/Matching'))
const Shelters = lazy(() => import('./pages/dash/Shelters'))
const Family = lazy(() => import('./pages/dash/Family'))
const Volunteers = lazy(() => import('./pages/dash/Volunteers'))
const Unreported = lazy(() => import('./pages/dash/Unreported'))
const OfflineCenter = lazy(() => import('./pages/dash/OfflineCenter'))
const Analytics = lazy(() => import('./pages/dash/Analytics'))
const Admin = lazy(() => import('./pages/dash/Admin'))

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<Loading className="min-h-[60vh]" />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="sos" element={<SOS />} />
          <Route path="request" element={<SubmitRequest />} />
          <Route path="communicate" element={<Communicate />} />
          <Route path="track" element={<Track />} />
          <Route path="volunteer" element={<VolunteerRegister />} />
          <Route path="register-support" element={<SupportRegister />} />
          <Route path="family" element={<FamilyReport />} />
          <Route path="shelter-finder" element={<ShelterFinderPage />} />
          <Route path="relay" element={<Relay />} />
          <Route path="login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="app" element={<DashboardLayout />}>
          <Route index element={<CommandCenter />} />
          <Route path="map" element={<DisasterMap />} />
          <Route path="requests" element={<Requests />} />
          <Route path="sos" element={<SOSMonitoring />} />
          <Route path="vulnerable" element={<Vulnerable />} />
          <Route path="ai" element={<AIIntelligence />} />
          <Route path="resources" element={<Resources />} />
          <Route path="matching" element={<Matching />} />
          <Route path="shelters" element={<Shelters />} />
          <Route path="family" element={<Family />} />
          <Route path="volunteers" element={<Volunteers />} />
          <Route path="unreported" element={<Unreported />} />
          <Route path="offline" element={<OfflineCenter />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
