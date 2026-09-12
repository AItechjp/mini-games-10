import cameraDocument from './document.html?raw';

// A top-level document keeps Safari camera/share gestures intact and isolates the camera styles.
export function GET() {
  return new Response(cameraDocument, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Permissions-Policy': 'camera=(self), microphone=(), web-share=(self)',
    },
  });
}
