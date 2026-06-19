const toHex = (bytes: Uint8Array) => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const generateRawApiToken = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `tk_prod_${toHex(bytes)}`
}

export const hashApiToken = async (token: string) => {
  const encoded = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return `sha256:${toHex(new Uint8Array(digest))}`
}
