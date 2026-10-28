import type {Metadata} from 'next';
import {Providers} from '@/components/providers';
import './globals.css';
export const metadata:Metadata={title:'789 NETWORK SOLUTIONS | Voice infrastructure',description:'Wholesale voice platform in development. Explore an explicitly labeled demo workspace. No live telecommunications services are operational.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;}
