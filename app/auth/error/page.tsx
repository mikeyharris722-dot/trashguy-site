type AuthErrorPageProps = {
  searchParams: Promise<{
    error?: string
    error_description?: string
  }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams

  const error = params.error ?? 'auth_error'
  const description = params.error_description ?? 'Authentication failed.'

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-4">Twitch login failed</h1>

        <p className="text-white/80 mb-6">
          The site is still working, but the Twitch auth flow did not finish.
        </p>

        <div className="rounded-xl bg-black/40 border border-white/10 p-4 mb-4">
          <p className="text-sm text-white/60 mb-1">Error</p>
          <p className="font-mono text-sm break-all">{error}</p>
        </div>

        <div className="rounded-xl bg-black/40 border border-white/10 p-4 mb-6">
          <p className="text-sm text-white/60 mb-1">Details</p>
          <p className="font-mono text-sm break-words">{description}</p>
        </div>

        <a
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500 transition"
        >
          Back to homepage
        </a>
      </div>
    </main>
  )
}