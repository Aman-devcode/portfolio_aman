const idPattern = /^[A-Za-z0-9._:-]{1,100}$/;
export function parseClientMessage(data, maxCharacters = 2000) {
  let message;
  try { message = JSON.parse(data.toString()); } catch { return { error: 'INVALID_MESSAGE', requestId: null }; }
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') return { error: 'INVALID_MESSAGE', requestId: null };
  if (message.type === 'chat.cancel') return idPattern.test(message.requestId || '') ? { value: { type: message.type, requestId: message.requestId } } : { error: 'INVALID_MESSAGE', requestId: null };
  if (message.type !== 'chat.start') return { error: 'INVALID_MESSAGE', requestId: idPattern.test(message.requestId || '') ? message.requestId : null };
  const requestId = idPattern.test(message.requestId || '') ? message.requestId : null;
  if (!requestId || typeof message.message !== 'string' || !message.message.trim()) return { error: 'INVALID_MESSAGE', requestId };
  if (message.message.length > maxCharacters) return { error: 'MESSAGE_TOO_LARGE', requestId };
  return { value: { type: message.type, requestId, message: message.message.trim() } };
}
export const serverMessage = (type, fields = {}) => ({ type, ...fields });
