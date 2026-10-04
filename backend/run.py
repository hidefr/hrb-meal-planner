import sys
import socket
import threading
import uvicorn
from app.config import settings

if sys.stdout is None or sys.stderr is None:
    log_file = settings.data_dir / "server.log"
    log_stream = open(log_file, "a", buffering=1, encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = log_stream
    if sys.stderr is None:
        sys.stderr = log_stream

def start_ipv6_loopback_proxy(port: int = 8000):
    """
    On modern Windows, browsers resolve 'localhost' to IPv6 '::1'.
    This bridges connections from [::1]:port to 127.0.0.1:port so
    http://localhost:8000 works immediately in Edge/Chrome.
    """
    def proxy_worker():
        try:
            s_v6 = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
            s_v6.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s_v6.bind(('::1', port))
            s_v6.listen(64)
            while True:
                client, _ = s_v6.accept()
                def bridge(c):
                    try:
                        target = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        target.connect(('127.0.0.1', port))
                        def pipe(src, dst):
                            try:
                                while True:
                                    data = src.recv(8192)
                                    if not data: break
                                    dst.sendall(data)
                            except: pass
                            finally:
                                try: src.close()
                                except: pass
                                try: dst.close()
                                except: pass
                        threading.Thread(target=pipe, args=(c, target), daemon=True).start()
                        threading.Thread(target=pipe, args=(target, c), daemon=True).start()
                    except:
                        try: c.close()
                        except: pass
                threading.Thread(target=bridge, args=(client,), daemon=True).start()
        except Exception as e:
            # Silently pass if IPv6 already bound or unsupported
            pass

    t = threading.Thread(target=proxy_worker, daemon=True)
    t.start()

if __name__ == "__main__":
    start_ipv6_loopback_proxy(settings.port)
    print(f"[TasteCraft] Starting server at http://{settings.host}:{settings.port} and http://localhost:{settings.port}")
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
