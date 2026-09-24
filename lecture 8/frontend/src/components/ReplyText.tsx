/**
 * Renders the small slice of Markdown the agent actually uses — **bold**
 * and "- " bullet lists — as React elements. No HTML is injected, so
 * reply text can't smuggle markup into the page.
 */

import type { ReactNode } from 'react'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4 ? (
      <strong key={i}>{chunk.slice(2, -2)}</strong>
    ) : (
      chunk
    ),
  )
}

export default function ReplyText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let items: string[] = []

  const flushList = () => {
    if (items.length) {
      blocks.push(
        <ul key={blocks.length} className="reply-list">
          {items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      )
      items = []
    }
  }

  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    if (bullet) {
      items.push(bullet[1])
      continue
    }
    flushList()
    if (line.trim()) blocks.push(<p key={blocks.length} className="reply-para">{inline(line.trim())}</p>)
  }
  flushList()
  return <>{blocks}</>
}
