/**
 * HTML Sanitization Utility for MCD-Agencia
 *
 * Provides client-side HTML sanitization to prevent XSS attacks.
 * Used for rendering user-generated or admin-generated HTML content.
 *
 * Note: This is a secondary defense layer. Primary sanitization should
 * happen on the backend before storing HTML content.
 */

// Allowed HTML tags for product descriptions
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'blockquote', 'pre', 'code',
  'img', 'figure', 'figcaption',
  'hr',
];

// Allowed attributes per tag
const ALLOWED_ATTRS: Record<string, string[]> = {
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'width', 'height'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan'],
  '*': ['class', 'id', 'style'],
};

// URL protocols allowed in href/src attributes
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Sanitize HTML content to prevent XSS attacks.
 *
 * Removes potentially dangerous elements and attributes while
 * preserving safe formatting HTML.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * const safe = sanitizeHtml('<p onclick="alert(1)">Hello <script>evil()</script></p>');
 * // Returns: '<p>Hello </p>'
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';

  // Use DOMParser for safe parsing (doesn't execute scripts)
  if (typeof window === 'undefined') {
    // Server-side: strip all tags as fallback
    return html.replace(/<[^>]*>/g, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  // Recursively sanitize nodes
  sanitizeNode(body);

  return body.innerHTML;
}

function sanitizeNode(node: Node): void {
  const nodesToRemove: Node[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();

      // Remove disallowed tags
      if (!ALLOWED_TAGS.includes(tagName)) {
        // For script/style/iframe etc, remove completely
        if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'].includes(tagName)) {
          nodesToRemove.push(child);
          return;
        }
        // For other tags, unwrap (keep children)
        while (element.firstChild) {
          node.insertBefore(element.firstChild, element);
        }
        nodesToRemove.push(child);
        return;
      }

      // Remove disallowed attributes
      const attrs = Array.from(element.attributes);
      const allowedForTag = ALLOWED_ATTRS[tagName] || [];
      const allowedGlobal = ALLOWED_ATTRS['*'] || [];
      const allAllowed = [...allowedForTag, ...allowedGlobal];

      attrs.forEach((attr) => {
        const attrName = attr.name.toLowerCase();

        // Remove event handlers
        if (attrName.startsWith('on')) {
          element.removeAttribute(attr.name);
          return;
        }

        // Remove javascript: URLs
        if (['href', 'src', 'action'].includes(attrName)) {
          const value = attr.value.trim().toLowerCase();
          if (value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('vbscript:')) {
            element.removeAttribute(attr.name);
            return;
          }
          // Validate protocol
          try {
            const url = new URL(attr.value, window.location.origin);
            if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
              element.removeAttribute(attr.name);
              return;
            }
          } catch {
            // Invalid URL, remove it
            element.removeAttribute(attr.name);
            return;
          }
        }

        // Remove non-allowed attributes
        if (!allAllowed.includes(attrName)) {
          element.removeAttribute(attr.name);
        }
      });

      // Add rel="noopener noreferrer" to external links
      if (tagName === 'a') {
        const href = element.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          element.setAttribute('rel', 'noopener noreferrer');
          element.setAttribute('target', '_blank');
        }
      }

      // Sanitize children
      sanitizeNode(child);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      // Remove comments (could contain sensitive info)
      nodesToRemove.push(child);
    }
  });

  // Remove marked nodes
  nodesToRemove.forEach((n) => n.parentNode?.removeChild(n));
}

/**
 * Strip all HTML tags, returning only text content.
 *
 * @param html - HTML string
 * @returns Plain text without any HTML tags
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
