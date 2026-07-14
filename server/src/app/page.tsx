export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 40, lineHeight: 1.5 }}>
      <h1>tans API</h1>
      <p>
        tRPC endpoint: <code>/api/trpc</code>
      </p>
      <p style={{ color: '#666' }}>
        Bootstrap a user then send the returned id as the <code>x-user-id</code> header
        on subsequent calls.
      </p>
    </main>
  );
}
