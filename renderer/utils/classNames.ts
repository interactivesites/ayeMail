// Simple classnames utility (cx)
// Accepts strings and object maps of conditional classes
export function cx(
  ...args: Array<string | false | null | undefined | Record<string, boolean>>
): string {
  const out: string[] = []
  for (const a of args) {
    if (!a) continue
    if (typeof a === 'string') out.push(a)
    else for (const [k, v] of Object.entries(a)) if (v) out.push(k)
  }
  return out.join(' ')
}

export default cx
