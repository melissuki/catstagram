import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { CatProfile } from '@/types'
import { searchProfilesByUsername } from '@/services/api'
import { useApp } from '@/context/AppContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Avatar } from '@/components/common/Avatar'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { profilePath } from '@/utils/username'

export function SearchPage() {
  const { currentUser } = useApp()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim().toLowerCase().replace(/^@+/, '')
    if (q.length < 2) {
      setResults([])
      setError(null)
      return
    }

    if (!currentUser?.id) {
      setResults([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void searchProfilesByUsername(q, currentUser.id)
        .then((data) => {
          if (!cancelled) setResults(data)
        })
        .catch((err) => {
          console.error('[search]', err)
          if (!cancelled) {
            setResults([])
            setError(
              err instanceof Error
                ? err.message
                : t.search.invalidPath,
            )
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, currentUser?.id, t.search.invalidPath])

  const trimmed = query.trim().toLowerCase().replace(/^@+/, '')

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="animate-fade-up px-1">
        <h2 className="font-brand text-2xl font-bold text-slate-700 dark:text-slate-100 sm:text-3xl">
          {t.search.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t.search.subtitle}
        </p>
      </header>

      <section className="card-panel animate-fade-up p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search.placeholder}
            className="input-field pl-10"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </section>

      {trimmed.length > 0 && trimmed.length < 2 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t.search.hint}
        </p>
      ) : null}

      {loading ? <LoadingSpinner label={t.common.loading} /> : null}

      {error ? (
        <div className="card-panel px-4 py-5 text-center">
          <p className="text-sm text-rose-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t.search.empty}
          </p>
        </div>
      ) : null}

      {!loading && !error && trimmed.length >= 2 ? (
        results.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.search.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((cat) => (
              <li key={cat.id}>
                <Link
                  to={profilePath(cat.id)}
                  className="card-panel flex items-center gap-3 p-3 transition hover:border-pink-300/50 dark:hover:border-pink-400/30"
                >
                  <Avatar src={cat.avatar} alt={cat.name} size="md" ring />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-100">
                      {cat.name}
                    </p>
                    <p className="truncate text-xs font-semibold text-pink-500">
                      @{cat.username}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
