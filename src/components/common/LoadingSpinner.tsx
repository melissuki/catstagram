interface LoadingSpinnerProps {
  label?: string
}

export function LoadingSpinner({ label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-purple-100 border-t-pink-400" />
      {label ? <p className="text-sm font-medium">{label}</p> : null}
    </div>
  )
}
