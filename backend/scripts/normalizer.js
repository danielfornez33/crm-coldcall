function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\_\(\)\.]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return `+${digits}`;
}

function parseVCF(content) {
  const contacts = [];
  const cards = content.split('END:VCARD').filter(Boolean);

  for (const card of cards) {
    const contact = { name: '', phone: '', phone2: '', org: '' };
    const lines = card.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('FN:')) {
        contact.name = trimmed.slice(3).trim();
      } else if (trimmed.startsWith('ORG:')) {
        contact.org = trimmed.slice(4).trim();
      } else if (trimmed.startsWith('TEL;') || trimmed.startsWith('TEL:')) {
        const value = trimmed.includes(':') ? trimmed.split(':').pop().trim() : '';
        if (!contact.phone) {
          contact.phone = value;
        } else if (!contact.phone2) {
          contact.phone2 = value;
        }
      } else if (trimmed.startsWith('N:')) {
        if (!contact.name) {
          const parts = trimmed.slice(2).split(';').filter(Boolean);
          contact.name = parts.join(' ').trim();
        }
      }
    }

    if (contact.phone) contacts.push(contact);
  }

  return contacts;
}

module.exports = { normalizePhone, parseVCF };
