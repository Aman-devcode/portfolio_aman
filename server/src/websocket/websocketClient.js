export function sendSocketMessage(socket, message) {
  if (socket.readyState !== 1) return false;
  try { socket.send(JSON.stringify(message)); return true; } catch { return false; }
}
