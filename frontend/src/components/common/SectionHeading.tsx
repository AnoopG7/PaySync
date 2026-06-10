import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  label?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}

export default function SectionHeading({
  label,
  title,
  subtitle,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-16 space-y-4', align === 'center' && 'text-center', className)}>
      {label && (
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-primary">
          {label}
        </span>
      )}
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      <div className={cn('h-1 w-16 rounded-full bg-gradient-to-r from-primary to-secondary', align === 'center' ? 'mx-auto' : '')} />
      {subtitle && (
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  )
}
