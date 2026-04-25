import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/sidebar'

export const metadata: Metadata = {
  title: 'Paladeium — Admin Dashboard',
  description: 'Manage AR restaurant menus',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen bg-[#0A0A0F] text-[#F0EDE8] overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
