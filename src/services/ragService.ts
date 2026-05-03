const API_URL = 'http://localhost:8000';

export async function queryRAGStream(
  userQuery: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/v1/query/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: userQuery,
        language: 'ar',
        limit: 12
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported by this browser.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    }

  } catch (error) {
    console.error("RAG Stream Error:", error);
    onChunk(`\n[CRITICAL ERROR]: Unable to reach Mishkat RAG backend.\nDetails: ${error instanceof Error ? error.message : 'Unknown network failure.'}`);
  }
}