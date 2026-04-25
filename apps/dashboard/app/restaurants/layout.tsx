import Sidebar from '@/components/sidebar'

export default function RestaurantsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0A0A0F] text-[#F0EDE8] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
