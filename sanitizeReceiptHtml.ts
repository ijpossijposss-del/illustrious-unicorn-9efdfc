export function sanitizeReceiptHtml(markup: string) {
  const documentParser = new DOMParser();
  const parsed = documentParser.parseFromString(markup, 'text/html');
  parsed.querySelectorAll('script, iframe, object, embed, form, link, style').forEach((node) => node.remove());
  parsed.querySelectorAll<HTMLElement>('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || ((name === 'src' || name === 'href') && value.startsWith('javascript:'))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return parsed.body.innerHTML;
}