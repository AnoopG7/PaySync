import { useEffect } from 'react'

interface PageMetaProps {
  title: string
  description?: string
}

export default function PageMeta({ title, description }: PageMetaProps) {
  useEffect(() => {
    document.title = title
    if (description) {
      const meta = document.querySelector('meta[name="description"]')
      if (meta) {
        meta.setAttribute('content', description)
      } else {
        const newMeta = document.createElement('meta')
        newMeta.name = 'description'
        newMeta.content = description
        document.head.appendChild(newMeta)
      }
    }
    return () => {
      document.title = 'PaySync — Digital Payments Cloud'
    }
  }, [title, description])

  return null
}
