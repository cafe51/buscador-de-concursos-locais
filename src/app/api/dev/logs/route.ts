import { NextRequest } from 'next/server';
import { getDevEmitter, getDevHistory, LogMessage } from '@/lib/devLogger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not Found', { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Ignorar se o stream já foi fechado
        }
      };

      // Envia o histórico ao conectar
      const history = getDevHistory();
      sendEvent({ type: 'history', logs: history });

      const handleLog = (log: LogMessage) => {
        sendEvent({ type: 'log', log });
      };

      const emitter = getDevEmitter();
      emitter.on('log', handleLog);

      req.signal.addEventListener('abort', () => {
        emitter.off('log', handleLog);
        try { controller.close(); } catch {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
