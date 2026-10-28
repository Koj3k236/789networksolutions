'use client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from 'next-themes';
import {useEffect,useState} from 'react';
import {Toaster} from './ui/sonner';
import {refreshSession} from '@/lib/api';
export const Providers=({children}:{children:React.ReactNode})=>{const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}}));useEffect(()=>{void refreshSession();},[]);return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><QueryClientProvider client={client}>{children}<Toaster closeButton visibleToasts={3}/></QueryClientProvider></ThemeProvider>;};
