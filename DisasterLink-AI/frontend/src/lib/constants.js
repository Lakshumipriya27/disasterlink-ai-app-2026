import { Ambulance, Apple, Droplets, HeartPulse, Home, LifeBuoy, Package, Shirt, Truck } from 'lucide-react'

export const CATEGORIES = {
  food: { label: 'Food', short: 'Food', icon: Apple, color: '#f59e0b' },
  water: { label: 'Drinking water', short: 'Water', icon: Droplets, color: '#06b6d4' },
  medicine: { label: 'Medicine', short: 'Medicine', icon: HeartPulse, color: '#ef4444' },
  shelter: { label: 'Shelter', short: 'Shelter', icon: Home, color: '#8b5cf6' },
  transport: { label: 'Transportation', short: 'Transport', icon: Truck, color: '#3b82f6' },
  clothing: { label: 'Clothing', short: 'Clothing', icon: Shirt, color: '#ec4899' },
  rescue: { label: 'Rescue assistance', short: 'Rescue', icon: LifeBuoy, color: '#dc2626' },
  other: { label: 'Other support', short: 'Other', icon: Package, color: '#64748b' },
}
export const RESOURCE_CATEGORIES = ['food', 'water', 'medicine', 'shelter', 'transport', 'clothing']
export const SOS_ICON = Ambulance

export const URGENCY = {
  critical: { label: 'Critical', tone: 'red', color: '#dc2626' },
  high: { label: 'High', tone: 'orange', color: '#ea580c' },
  medium: { label: 'Medium', tone: 'blue', color: '#2563eb' },
  low: { label: 'Low', tone: 'gray', color: '#64748b' },
}

export const STATUS = {
  pending: { label: 'Pending', tone: 'gray' }, verified: { label: 'Verified', tone: 'cyan' },
  in_progress: { label: 'In progress', tone: 'blue' }, fulfilled: { label: 'Fulfilled', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' }, duplicate: { label: 'Duplicate', tone: 'purple' },
  suggested: { label: 'Suggested', tone: 'gray' }, awaiting_approval: { label: 'Awaiting approval', tone: 'orange' },
  approved: { label: 'Approved', tone: 'cyan' }, dispatched: { label: 'Dispatched', tone: 'blue' },
  awaiting_response: { label: 'Awaiting response', tone: 'red' }, acknowledged: { label: 'Acknowledged', tone: 'orange' },
  team_dispatched: { label: 'Team dispatched', tone: 'blue' }, assisted: { label: 'Assisted', tone: 'green' },
  closed: { label: 'Closed', tone: 'gray' }, unverified: { label: 'Unverified', tone: 'gray' },
  false_alarm: { label: 'False alarm', tone: 'gray' }, open: { label: 'Open', tone: 'green' }, full: { label: 'Full', tone: 'orange' },
  assigned: { label: 'Assigned', tone: 'orange' }, accepted: { label: 'Accepted', tone: 'blue' }, completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' }, available: { label: 'Available', tone: 'green' }, busy: { label: 'Busy', tone: 'orange' },
  offline: { label: 'Offline', tone: 'gray' }, limited: { label: 'Limited', tone: 'orange' }, depleted: { label: 'Depleted', tone: 'red' },
  reunited: { label: 'Reunited', tone: 'green' }, given: { label: 'Consent given', tone: 'green' }, withdrawn: { label: 'Withdrawn', tone: 'gray' },
  synced: { label: 'Delivered to server', tone: 'green' }, syncing: { label: 'Sending…', tone: 'blue' },
  failed: { label: 'Send failed – will retry', tone: 'orange' },
}

export const AREAS = {
  'North Chennai': [13.121, 80.288], Tambaram: [12.9249, 80.1], Velachery: [12.9815, 80.218], Avadi: [13.1147, 80.1018],
  Perungudi: [12.9654, 80.2461], Pallikaranai: [12.9349, 80.2137], Mudichur: [12.912, 80.07],
}
export const CHENNAI_CENTER = [13.02, 80.19]

export const VP_CATEGORIES = {
  elderly_alone: 'Elderly living alone', mobility: 'Mobility limitation', medical: 'Regular medical assistance',
  visual: 'Visual disability', hearing: 'Hearing disability', accessible_transport: 'Needs accessible transport',
  special_shelter: 'Special shelter arrangements',
}
export const ASSIST_TYPES = {
  food_distribution: 'Food distribution', water_distribution: 'Water distribution', transportation: 'Transportation',
  shelter_assistance: 'Shelter assistance', welfare_checks: 'Welfare checks', general_relief: 'General relief support',
}
export const label = (map, key) => map[key]?.label || map[key] || (key ? String(key).replace(/_/g, ' ') : '—')
