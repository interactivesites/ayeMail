/**
 * Tracking Pixel Filter
 * Detects and removes tracking pixels from HTML email content
 */

/**
 * Filter tracking pixels from HTML content
 * Removes images that match common tracking pixel patterns
 */
export function filterTrackingPixels(html: string): string {
  if (!html) return html

  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // Find all img tags
  const images = tempDiv.querySelectorAll('img')
  const imagesToRemove: HTMLImageElement[] = []

  images.forEach((img) => {
    if (isTrackingPixel(img)) {
      imagesToRemove.push(img)
    }
  })

  // Remove tracking pixels
  imagesToRemove.forEach((img) => {
    img.remove()
  })

  return tempDiv.innerHTML
}

/**
 * Check if an image element is a tracking pixel
 */
function isTrackingPixel(img: HTMLImageElement): boolean {
  const src = img.src || img.getAttribute('src') || ''
  const width = img.width || parseInt(img.getAttribute('width') || '0') || 0
  const height = img.height || parseInt(img.getAttribute('height') || '0') || 0
  const style = img.getAttribute('style') || ''
  const alt = (img.getAttribute('alt') || '').toLowerCase()
  const className = (img.getAttribute('class') || '').toLowerCase()

  // Skip data URLs and CID references (these are safe)
  if (src.startsWith('data:') || src.startsWith('cid:')) {
    return false
  }

  // Check 1: Dimensions - 1x1 pixels (most common tracking pixel size)
  if ((width === 1 && height === 1) || (width === 0 && height === 0)) {
    return true
  }

  // Check 2: Style-based dimensions
  const styleWidth = style.match(/width\s*:\s*1px/i) || style.match(/width\s*:\s*1\s*px/i)
  const styleHeight = style.match(/height\s*:\s*1px/i) || style.match(/height\s*:\s*1\s*px/i)
  if (styleWidth && styleHeight) {
    return true
  }

  // Check 3: Filename patterns in URL
  const urlLower = src.toLowerCase()
  const trackingPatterns = [
    'tracking',
    'pixel',
    'beacon',
    'spacer',
    'clear',
    '1x1',
    'track',
    'open',
    'click',
    'analytics',
    'monitor',
    'counter',
    'log',
  ]
  
  if (trackingPatterns.some(pattern => urlLower.includes(pattern))) {
    return true
  }

  // Check 4: Alt text or class name patterns
  const altClassPatterns = ['spacer', 'tracking', 'pixel', 'beacon', 'clear', '1x1']
  if (altClassPatterns.some(pattern => alt.includes(pattern) || className.includes(pattern))) {
    return true
  }

  // Check 5: Very small file size indicators in filename
  // Common tracking pixel filenames: pixel.gif, clear.gif, spacer.gif, etc.
  const filenameMatch = src.match(/\/([^\/\?]+)(\?|$)/)
  if (filenameMatch) {
    const filename = filenameMatch[1].toLowerCase()
    const smallFilePatterns = ['pixel', 'spacer', 'clear', 'dot', 'blank', 'transparent']
    if (smallFilePatterns.some(pattern => filename.includes(pattern))) {
      // Additional check: if dimensions are also small or missing, likely tracking
      if (width <= 1 && height <= 1) {
        return true
      }
    }
  }

  return false
}

