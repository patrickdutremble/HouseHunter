import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'HouseHunter',
  description: 'Real estate listing comparison tool',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'HouseHunter',
    statusBarStyle: 'black',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full antialiased font-[family-name:var(--font-inter)]">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
