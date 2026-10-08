/** Retry read failures only. Never retry a draw or prize write automatically. */
export async function retryLuckRead<T extends { error: unknown }>(
  read: () => PromiseLike<T>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await read();
      if (!result.error || attempt === 2) return result;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await wait(attempt === 0 ? 500 : 1000);
  }
}
