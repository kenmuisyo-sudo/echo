import { FiCheckCircle } from 'react-icons/fi'

/**
 * Horizontal step indicator for a workflow pipeline.
 * @param {Array} steps - [{ label, status }] where status is 'done' | 'active' | 'pending'
 */
export default function StatusSteps({ steps = [] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {steps.map((s, i) => {
        const tone =
          s.status === 'done'
            ? 'bg-primary text-white'
            : s.status === 'active'
              ? 'bg-accent text-white'
              : 'bg-slate-100 text-slate-400'
        const textTone =
          s.status === 'done' ? 'text-primary' : s.status === 'active' ? 'text-accent' : 'text-slate-400'
        return (
          <div key={s.label} className="flex flex-1 items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
              {s.status === 'done' ? <FiCheckCircle /> : i + 1}
            </div>
            <div>
              <p className={`text-sm font-medium ${textTone}`}>{s.label}</p>
              <p className="text-xs text-slate-400">{s.status === 'done' ? 'Complete' : s.status === 'active' ? 'In progress' : 'Pending'}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
