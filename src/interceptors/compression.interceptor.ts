// d:\GitHub\Compression\compression.client\src\app\interceptors\compression.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
} from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable()
export class CompressionInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Only compress POST/PUT requests with body
    if ((request.method === 'POST' || request.method === 'PUT') && request.body) {
      return from(this.compressBody(request.body)).pipe(
        switchMap((compressedBody) => {
          const compressedRequest = request.clone({
            body: new Blob([compressedBody as any], { type: 'application/json' }),
            setHeaders: {
              'Content-Encoding': 'gzip',
              'Content-Type': 'application/json',
            },
          });
          return next.handle(compressedRequest);
        }),
        map((event: HttpEvent<any>) => {
          if (event instanceof HttpResponse) {
            const contentEncoding = event.headers.get('Content-Encoding');
            if (contentEncoding) {
              console.log(`Response compressed with: ${contentEncoding}`);
            }
          }
          return event;
        })
      );
    }

    // For GET requests, just add Accept-Encoding header
    const requestWithHeaders = request.clone({
      setHeaders: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    return next.handle(requestWithHeaders).pipe(
      map((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          const contentEncoding = event.headers.get('Content-Encoding');
          if (contentEncoding) {
            console.log(`Response compressed with: ${contentEncoding}`);
          }
        }
        return event;
      })
    );
  }

  private async compressBody(body: any): Promise<Uint8Array> {
    const jsonString = JSON.stringify(body);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);

    // Create a ReadableStream from the data
    const readableStream = new ReadableStream({
      start(controller: any) {
        controller.enqueue(data);
        controller.close();
      },
    });

    // Use native CompressionStream API
    const compressedStream = readableStream.pipeThrough(
      new (window as any).CompressionStream('gzip')
    );

    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];

    let result = await reader.read();
    while (!result.done) {
      chunks.push(result.value as Uint8Array);
      result = await reader.read();
    }

    return new Uint8Array(
      chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[])
    );
  }
}