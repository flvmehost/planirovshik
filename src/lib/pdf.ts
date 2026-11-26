interface TextChunk {
  text: string
  x: number
  y: number
  width: number
}

/** Собирает текстовые строки PDF с сохранением порядка колонок. */
export async function extractPdfText(file: File): Promise<string> {
  // pdf.js весит больше мегабайта — грузим только при первом импорте.
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = new Uint8Array(await file.arrayBuffer())
  const document = await pdfjs.getDocument({ data }).promise
  const lines: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const chunks: TextChunk[] = []

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const transform = item.transform
      chunks.push({
        text: item.str,
        x: transform[4],
        y: transform[5],
        width: item.width ?? 0,
      })
    }

    const rows: { y: number; chunks: TextChunk[] }[] = []
    for (const chunk of chunks) {
      const row = rows.find((candidate) => Math.abs(candidate.y - chunk.y) < 3)
      if (row) row.chunks.push(chunk)
      else rows.push({ y: chunk.y, chunks: [chunk] })
    }

    rows.sort((left, right) => right.y - left.y)
    for (const row of rows) {
      row.chunks.sort((left, right) => left.x - right.x)
      let line = ''
      let previousEnd = Number.NEGATIVE_INFINITY
      for (const chunk of row.chunks) {
        if (line) line += chunk.x - previousEnd > 5 ? '  ' : ' '
        line += chunk.text
        previousEnd = chunk.x + chunk.width
      }
      lines.push(line)
    }
    lines.push('')
  }

  return lines.join('\n')
}
