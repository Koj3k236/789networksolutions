import Link from 'next/link';
export default function NotFound(){return <main className="empty-state min-h-screen" data-testid="not-found"><h1>This connection leads nowhere.</h1><p>The page you’re looking for isn’t part of this workspace.</p><Link className="text-link" href="/dashboard/" data-testid="not-found-home">Return to your dashboard</Link></main>;}
