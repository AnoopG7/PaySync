import { Outlet } from 'react-router-dom'
import { Navbar, Footer, ScrollToTop } from '@/components/layout'

export default function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <ScrollToTop />
      <main className="flex-1 pt-16">
        <div className="container mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
