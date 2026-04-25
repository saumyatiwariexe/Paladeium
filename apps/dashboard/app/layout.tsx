import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paladeium — Admin Dashboard',
  description: 'Manage AR restaurant menus',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0A0A0F] text-[#F0EDE8]">
        {children}
      </body>
    </html>
  )
}
