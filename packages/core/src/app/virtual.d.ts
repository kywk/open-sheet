declare module 'virtual:open-sheet/manifest' {
  export interface ManifestEntry {
    id: string
    load: () => Promise<{
      default: unknown
      meta?: { title?: string; description?: string; theme?: string }
      design?: unknown
    }>
  }
  export const workbooks: ManifestEntry[]
  export const sheetsDir: string
}
