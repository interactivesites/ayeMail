/**
 * URL Security Utilities
 * Checks for potentially dangerous or suspicious URLs
 */

export interface UrlSecurityCheck {
  isSafe: boolean
  riskLevel: 'safe' | 'low' | 'medium' | 'high'
  warnings: string[]
  displayUrl: string
  actualUrl: string
}

/**
 * Check if a URL is safe to open
 */
export function checkUrlSecurity(url: string, displayText?: string): UrlSecurityCheck {
  const warnings: string[] = []
  let riskLevel: 'safe' | 'low' | 'medium' | 'high' = 'safe'
  
  try {
    // Parse the URL
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const displayUrl = displayText || url
    
    // Extract actual URL (resolve relative URLs if needed)
    let actualUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
      // Relative URL - this shouldn't happen in emails but handle it
      actualUrl = urlObj.href
    }
    
    // Check 1: IP addresses (often used in phishing)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipRegex.test(hostname)) {
      warnings.push('This link uses an IP address instead of a domain name')
      riskLevel = 'medium'
    }
    
    // Check 2: Suspicious TLDs
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.click', '.download']
    const hasSuspiciousTld = suspiciousTlds.some(tld => hostname.endsWith(tld))
    if (hasSuspiciousTld) {
      warnings.push('This link uses a suspicious top-level domain')
      riskLevel = riskLevel === 'safe' ? 'low' : riskLevel
    }
    
    // Check 3: Lookalike domains (common phishing technique)
    // Check for common lookalike patterns
    const lookalikePatterns = [
      /[a-z0-9]+-[a-z0-9]+\.(com|net|org|co|io)/, // hyphenated domains
      /[0-9]+[a-z]+\.(com|net|org)/, // numbers before letters
      /[a-z]+[0-9]+\.(com|net|org)/, // letters before numbers
    ]
    
    const hasLookalikePattern = lookalikePatterns.some(pattern => pattern.test(hostname))
    if (hasLookalikePattern && !isCommonDomain(hostname)) {
      warnings.push('This link uses an unusual domain pattern')
      riskLevel = riskLevel === 'safe' ? 'low' : riskLevel
    }
    
    // Check 4: URL mismatch (display text doesn't match actual URL)
    if (displayText && displayText !== url) {
      try {
        const displayUrlObj = new URL(displayText)
        if (displayUrlObj.hostname.toLowerCase() !== hostname) {
          warnings.push('The link text does not match the actual URL')
          riskLevel = 'high'
        }
      } catch {
        // Display text is not a URL, check if it looks like a different domain
        const domainInText = extractDomainFromText(displayText)
        if (domainInText && domainInText.toLowerCase() !== hostname) {
          warnings.push('The link text appears to point to a different website')
          riskLevel = 'high'
        }
      }
    }
    
    // Check 5: Non-standard ports (often used for malicious purposes)
    if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
      warnings.push('This link uses a non-standard port')
      riskLevel = riskLevel === 'safe' ? 'low' : riskLevel
    }
    
    // Check 6: JavaScript/data URLs (should be blocked)
    if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
      warnings.push('This link uses a potentially dangerous protocol')
      riskLevel = 'high'
      return {
        isSafe: false,
        riskLevel: 'high',
        warnings,
        displayUrl,
        actualUrl
      }
    }
    
    // Check 7: File protocol (local file access)
    if (url.startsWith('file://')) {
      warnings.push('This link attempts to access local files')
      riskLevel = 'high'
      return {
        isSafe: false,
        riskLevel: 'high',
        warnings,
        displayUrl,
        actualUrl
      }
    }
    
    // Check 8: Shortened URLs (could hide malicious destinations)
    const shortenerDomains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly']
    if (shortenerDomains.some(domain => hostname.includes(domain))) {
      warnings.push('This is a shortened URL - the destination may be hidden')
      riskLevel = riskLevel === 'safe' ? 'low' : riskLevel
    }
    
    // Check 9: HTTP (not HTTPS) for sensitive domains
    if (urlObj.protocol === 'http:' && !isLocalhost(hostname)) {
      warnings.push('This link is not encrypted (HTTP instead of HTTPS)')
      riskLevel = riskLevel === 'safe' ? 'low' : riskLevel
    }
    
    // Determine if safe based on risk level
    const isSafe = riskLevel !== 'high'
    
    return {
      isSafe,
      riskLevel,
      warnings,
      displayUrl,
      actualUrl
    }
  } catch (error) {
    // Invalid URL
    return {
      isSafe: false,
      riskLevel: 'high',
      warnings: ['Invalid URL format'],
      displayUrl: displayText || url,
      actualUrl: url
    }
  }
}

/**
 * Check if domain is a common/trusted domain
 */
function isCommonDomain(hostname: string): boolean {
  const commonDomains = [
    'google.com', 'gmail.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
    'linkedin.com', 'github.com', 'amazon.com', 'microsoft.com', 'apple.com', 'netflix.com',
    'wikipedia.org', 'reddit.com', 'stackoverflow.com', 'medium.com', 'dropbox.com',
    'paypal.com', 'stripe.com', 'shopify.com', 'ebay.com', 'etsy.com'
  ]
  
  return commonDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  )
}

/**
 * Extract domain-like text from display text
 */
function extractDomainFromText(text: string): string | null {
  // Simple regex to find domain-like patterns
  const domainRegex = /([a-z0-9-]+\.)+[a-z]{2,}/i
  const match = text.match(domainRegex)
  return match ? match[0] : null
}

/**
 * Check if hostname is localhost or local
 */
function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         hostname.startsWith('192.168.') ||
         hostname.startsWith('10.') ||
         hostname.startsWith('172.')
}

