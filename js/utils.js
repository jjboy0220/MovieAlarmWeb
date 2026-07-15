// 提供不涉及倒數邏輯的通用字串工具。
export function normalizeText(value) { return String(value??'').replace(/\s+/g,' ').trim(); }
export function escapeHtml(value) { return String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character])); }
export function createId(prefix='item') { return `${prefix}-${Date.now().toString(36)}`; }
