import os
import sys
import socket
from pathlib import Path

# Force UTF-8 on Windows stdout/stderr
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import uvicorn

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    # Ensure backend directory is in sys.path
    backend_dir = Path(__file__).resolve().parent / "backend"
    sys.path.insert(0, str(backend_dir))
    
    local_ip = get_local_ip()
    
    print("=" * 65)
    print("  GGI TUCKSHOP - ESSENTIALS & CANTEEN CART")
    print("  Running on Public / Local Network (0.0.0.0:8000)")
    print("=" * 65)
    print(f"  [Local PC]    http://127.0.0.1:8000")
    print(f"  [Network/LAN] http://{local_ip}:8000")
    print(f"  [Admin PIN]   1234")
    print("=" * 65)
    
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False, app_dir=str(backend_dir))
