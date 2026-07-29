function logStorageError(operation: string, key: string, error: unknown) {
  console.error(`[sessionStorage] Falha ao ${operation} chave "${key}"`, error);
}

export function readSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    logStorageError('ler', key, error);
    return null;
  }
}

export function writeSessionItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    logStorageError('escrever', key, error);
    return false;
  }
}

export function removeSessionItem(key: string): boolean {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    logStorageError('remover', key, error);
    return false;
  }
}
