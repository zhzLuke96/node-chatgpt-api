type ReadableStream = Awaited<ReturnType<typeof globalThis.fetch>>["body"];
export async function* streamAsyncIterable(
  stream: NonNullable<ReadableStream>
) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
