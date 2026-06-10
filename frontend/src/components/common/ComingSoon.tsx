import { toast } from 'sonner'
import { Clock } from 'lucide-react'

interface ComingSoonProps {
  children: React.ReactElement
  message?: string
}

export default function ComingSoon({ children, message = 'Coming Soon' }: ComingSoonProps) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        toast(message, {
          icon: <Clock className="h-4 w-4" />,
          duration: 2500,
        })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toast(message, {
            icon: <Clock className="h-4 w-4" />,
            duration: 2500,
          })
        }
      }}
      role="button"
      tabIndex={0}
      className="inline-block"
    >
      {children}
    </span>
  )
}
