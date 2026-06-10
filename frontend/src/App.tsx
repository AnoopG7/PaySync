import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from '@/routes'

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableColorScheme
      disableTransitionOnChange
    >
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand={false}
        />
      </BrowserRouter>
    </ThemeProvider>
  )
}
