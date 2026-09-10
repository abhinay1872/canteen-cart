import json
import random
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PRODUCTS_FILE = DATA_DIR / "products.json"
ORDERS_FILE = DATA_DIR / "orders.json"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

DATA_DIR.mkdir(parents=True, exist_ok=True)
file_lock = threading.Lock()

# ----------------- Helper Functions for JSON Storage ----------------- #
def read_json_file(file_path: Path, default_data: Any) -> Any:
    with file_lock:
        if not file_path.exists():
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(default_data, f, indent=2)
            return default_data
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default_data


def write_json_file(file_path: Path, data: Any) -> None:
    with file_lock:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


def migrate_orders_data() -> None:
    """Ensure all items in existing orders have 'packed' attribute and phone fields are consistent."""
    orders = read_json_file(ORDERS_FILE, [])
    updated = False
    for order in orders:
        is_order_finished = order.get("order_status") in ["Ready for Counter Pickup", "Ready for Pickup", "Handed Over", "Completed"]
        if "items" in order and isinstance(order["items"], list):
            for item in order["items"]:
                if "packed" not in item:
                    item["packed"] = True if is_order_finished else False
                    updated = True
        if "customer_phone" not in order and "phone" in order:
            order["customer_phone"] = order["phone"]
            updated = True
    if updated:
        write_json_file(ORDERS_FILE, orders)

# Run migration on startup
migrate_orders_data()


# ----------------- WebSocket Connection Manager ----------------- #
class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        disconnected: List[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for dead_conn in disconnected:
            self.disconnect(dead_conn)


ws_manager = ConnectionManager()

# ----------------- FastAPI App Initialization ----------------- #
app = FastAPI(title="Campus Tuck Shop & Canteen Kart API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- Pydantic Models ----------------- #
class ProductCreate(BaseModel):
    name: str
    category: str
    price: float = Field(..., gt=0)
    is_sold_out: bool = False
    img_url: str
    description: Optional[str] = ""


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    is_sold_out: Optional[bool] = None
    img_url: Optional[str] = None
    description: Optional[str] = None


class OrderItem(BaseModel):
    id: int
    name: str
    qty: int = Field(..., gt=0)
    price: float = Field(..., ge=0)
    packed: bool = False


class OrderCreate(BaseModel):
    customer_name: str
    phone: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[OrderItem]
    total_amount: float
    payment_method: str  # "UPI" or "Pay at Counter"


class OrderPatch(BaseModel):
    order_status: Optional[str] = None  # Pending, Packing, In Progress / Preparing, Ready for Counter Pickup / Ready for Pickup, Handed Over / Completed
    payment_status: Optional[str] = None  # Paid, Unpaid - Cash on Delivery, Pending Counter Payment
    items: Optional[List[Dict[str, Any]]] = None


class ItemPackPatch(BaseModel):
    packed: Optional[bool] = None


class PackAllPatch(BaseModel):
    packed: bool = True


class NotificationSubscribe(BaseModel):
    product_id: int
    subscriber: str  # Student Phone or Roll Number


class PinVerify(BaseModel):
    pin: str


# ----------------- 4-Digit Token Generator ----------------- #
def generate_unique_token(existing_orders: List[Dict[str, Any]]) -> str:
    """
    Generates an immutable, non-repeating 4-digit pickup token (e.g. 7391).
    Ensures that the token does not collide with currently active orders.
    """
    active_tokens = {
        order["token"]
        for order in existing_orders
        if order.get("order_status") in ["Pending", "In Progress", "Preparing", "Ready for Counter Pickup", "Ready for Pickup"]
    }
    
    for _ in range(500):
        token = str(random.randint(1000, 9999))
        if token not in active_tokens:
            return token
            
    return str(random.randint(1000, 9999))


# ----------------- Product Endpoints (Full CRUD) ----------------- #
@app.get("/api/products")
def get_products():
    products = read_json_file(PRODUCTS_FILE, [])
    return products


@app.post("/api/products")
async def create_product(product_in: ProductCreate):
    products = read_json_file(PRODUCTS_FILE, [])
    new_id = max([p.get("id", 0) for p in products], default=100) + 1
    new_product = {
        "id": new_id,
        "name": product_in.name.strip(),
        "category": product_in.category.strip(),
        "price": round(float(product_in.price), 2),
        "is_sold_out": product_in.is_sold_out,
        "img_url": product_in.img_url.strip(),
        "description": product_in.description.strip() if product_in.description else "",
    }
    products.append(new_product)
    write_json_file(PRODUCTS_FILE, products)

    await ws_manager.broadcast({"type": "PRODUCT_CREATED", "product": new_product})
    return new_product


@app.put("/api/products/{product_id}")
async def update_product(product_id: int, update_data: ProductUpdate):
    products = read_json_file(PRODUCTS_FILE, [])
    found_idx = next((i for i, p in enumerate(products) if p["id"] == product_id), None)
    if found_idx is None:
        raise HTTPException(status_code=404, detail="Product not found")

    target = products[found_idx]
    if update_data.name is not None:
        target["name"] = update_data.name.strip()
    if update_data.category is not None:
        target["category"] = update_data.category.strip()
    if update_data.price is not None:
        target["price"] = round(float(update_data.price), 2)
    if update_data.is_sold_out is not None:
        target["is_sold_out"] = update_data.is_sold_out
    if update_data.img_url is not None:
        target["img_url"] = update_data.img_url.strip()
    if update_data.description is not None:
        target["description"] = update_data.description.strip()

    products[found_idx] = target
    write_json_file(PRODUCTS_FILE, products)

    await ws_manager.broadcast({"type": "PRODUCT_UPDATED", "product": target})
    return target


@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int):
    products = read_json_file(PRODUCTS_FILE, [])
    found_idx = next((i for i, p in enumerate(products) if p["id"] == product_id), None)
    if found_idx is None:
        raise HTTPException(status_code=404, detail="Product not found")

    deleted = products.pop(found_idx)
    write_json_file(PRODUCTS_FILE, products)

    await ws_manager.broadcast({"type": "PRODUCT_DELETED", "product_id": product_id})
    return {"success": True, "message": f"Product '{deleted.get('name')}' removed successfully", "product": deleted}


# ----------------- Order Endpoints ----------------- #
@app.get("/api/orders")
def get_orders():
    orders = read_json_file(ORDERS_FILE, [])
    return list(reversed(orders))


@app.post("/api/orders")
async def create_order(order_in: OrderCreate):
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    if not order_in.customer_name.strip():
        raise HTTPException(status_code=400, detail="Customer name is required")
    
    phone_val = (order_in.customer_phone or order_in.phone or "").strip()
    if not phone_val:
        raise HTTPException(status_code=400, detail="Phone number is required")

    orders = read_json_file(ORDERS_FILE, [])
    
    order_num = len(orders) + 101
    order_id = f"ORD-{order_num}"
    token = generate_unique_token(orders)

    payment_status = "Paid" if order_in.payment_method == "UPI" else "Pending Counter Payment"

    new_order = {
        "order_id": order_id,
        "token": token,
        "customer_name": order_in.customer_name.strip(),
        "phone": phone_val,
        "customer_phone": phone_val,
        "items": [item.model_dump() for item in order_in.items],
        "total_amount": round(float(order_in.total_amount), 2),
        "payment_method": order_in.payment_method,
        "payment_status": payment_status,
        "order_status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    orders.append(new_order)
    write_json_file(ORDERS_FILE, orders)

    await ws_manager.broadcast({"type": "NEW_ORDER", "order": new_order})
    return new_order


@app.patch("/api/orders/{order_id}")
async def update_order_status(order_id: str, patch_data: OrderPatch):
    orders = read_json_file(ORDERS_FILE, [])
    found_idx = next((i for i, o in enumerate(orders) if o["order_id"] == order_id), None)
    if found_idx is None:
        raise HTTPException(status_code=404, detail="Order not found")

    target = orders[found_idx]
    if patch_data.order_status is not None:
        valid_statuses = [
            "Pending", 
            "Packing",
            "In Progress", "Preparing", 
            "Ready for Counter Pickup", "Ready for Pickup", 
            "Handed Over", "Completed"
        ]
        if patch_data.order_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {valid_statuses}")
        target["order_status"] = patch_data.order_status

    if patch_data.payment_status is not None:
        target["payment_status"] = patch_data.payment_status

    if patch_data.items is not None:
        target["items"] = patch_data.items

    orders[found_idx] = target
    write_json_file(ORDERS_FILE, orders)

    await ws_manager.broadcast({"type": "ORDER_UPDATED", "order": target})
    return target


@app.patch("/api/orders/{order_id}/items/{item_id}/pack")
async def toggle_item_packed(order_id: str, item_id: int, patch_data: Optional[ItemPackPatch] = None):
    orders = read_json_file(ORDERS_FILE, [])
    found_idx = next((i for i, o in enumerate(orders) if o["order_id"] == order_id), None)
    if found_idx is None:
        raise HTTPException(status_code=404, detail="Order not found")

    target = orders[found_idx]
    items = target.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item #{item_id} not found in order {order_id}")

    if patch_data and patch_data.packed is not None:
        item["packed"] = patch_data.packed
    else:
        item["packed"] = not item.get("packed", False)

    # Intelligent Order Status Pipeline Transition:
    total_items = len(items)
    packed_items = sum(1 for it in items if it.get("packed", False))

    if packed_items == total_items and total_items > 0:
        if target.get("order_status") not in ["Handed Over", "Completed"]:
            target["order_status"] = "Ready for Counter Pickup"
    elif packed_items > 0:
        if target.get("order_status") in ["Pending", "Ready for Counter Pickup", "Ready for Pickup"]:
            target["order_status"] = "Packing"
    else:
        if target.get("order_status") == "Ready for Counter Pickup":
            target["order_status"] = "Packing"

    orders[found_idx] = target
    write_json_file(ORDERS_FILE, orders)

    await ws_manager.broadcast({
        "type": "ORDER_UPDATED",
        "order": target,
        "action": "ITEM_PACKED",
        "item_id": item_id,
        "packed": item["packed"]
    })
    return target


@app.patch("/api/orders/{order_id}/pack-all")
async def pack_all_items(order_id: str, patch_data: Optional[PackAllPatch] = None):
    orders = read_json_file(ORDERS_FILE, [])
    found_idx = next((i for i, o in enumerate(orders) if o["order_id"] == order_id), None)
    if found_idx is None:
        raise HTTPException(status_code=404, detail="Order not found")

    target = orders[found_idx]
    should_pack = patch_data.packed if patch_data is not None else True
    for it in target.get("items", []):
        it["packed"] = should_pack

    if should_pack:
        if target.get("order_status") not in ["Handed Over", "Completed"]:
            target["order_status"] = "Ready for Counter Pickup"
    else:
        if target.get("order_status") not in ["Handed Over", "Completed"]:
            target["order_status"] = "Pending"

    orders[found_idx] = target
    write_json_file(ORDERS_FILE, orders)

    await ws_manager.broadcast({
        "type": "ORDER_UPDATED",
        "order": target,
        "action": "PACK_ALL",
        "packed": should_pack
    })
    return target



# ----------------- Restock Notification Endpoints ----------------- #
@app.get("/api/notifications")
def get_notifications():
    notifications = read_json_file(NOTIFICATIONS_FILE, [])
    return notifications


@app.post("/api/notifications")
async def subscribe_notification(req: NotificationSubscribe):
    subscriber = req.subscriber.strip()
    if not subscriber:
        raise HTTPException(status_code=400, detail="Roll Number or Mobile Number is required")

    products = read_json_file(PRODUCTS_FILE, [])
    product = next((p for p in products if p["id"] == req.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    notifications = read_json_file(NOTIFICATIONS_FILE, [])
    target = next((n for n in notifications if n["product_id"] == req.product_id), None)

    if target:
        if subscriber not in target["subscribers"]:
            target["subscribers"].append(subscriber)
        target["status"] = "Pending"
        target["updated_at"] = datetime.now(timezone.utc).isoformat()
    else:
        target = {
            "product_id": product["id"],
            "product_name": product["name"],
            "subscribers": [subscriber],
            "status": "Pending",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        notifications.append(target)

    write_json_file(NOTIFICATIONS_FILE, notifications)

    await ws_manager.broadcast({"type": "NOTIFICATION_UPDATED", "notification": target})
    return {
        "success": True,
        "message": f"Subscribed for restock alerts on {product['name']}",
        "notification": target,
        "subscriber_count": len(target["subscribers"]),
    }


@app.post("/api/notifications/{product_id}/notify")
async def send_restock_alerts(product_id: int):
    notifications = read_json_file(NOTIFICATIONS_FILE, [])
    target = next((n for n in notifications if n["product_id"] == product_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="No notification records for this product")

    subscriber_count = len(target.get("subscribers", []))
    target["status"] = "Alerted"
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    write_json_file(NOTIFICATIONS_FILE, notifications)

    # Restock product automatically in products.json
    products = read_json_file(PRODUCTS_FILE, [])
    prod_idx = next((i for i, p in enumerate(products) if p["id"] == product_id), None)
    if prod_idx is not None:
        products[prod_idx]["is_sold_out"] = False
        write_json_file(PRODUCTS_FILE, products)
        await ws_manager.broadcast({"type": "PRODUCT_UPDATED", "product": products[prod_idx]})

    await ws_manager.broadcast({
        "type": "RESTOCK_ALERTS_SENT",
        "product_id": product_id,
        "product_name": target.get("product_name"),
        "subscribers_alerted": subscriber_count
    })

    return {
        "success": True,
        "message": f"Sent restock alerts to {subscriber_count} students!",
        "subscribers_alerted": subscriber_count
    }


# ----------------- Admin PIN Verification ----------------- #
ADMIN_PIN = "1234"

@app.post("/api/admin/verify-pin")
def verify_admin_pin(data: PinVerify):
    if data.pin.strip() == ADMIN_PIN:
        return {"success": True, "message": "Admin access granted"}
    return {"success": False, "error": "Invalid PIN. Default is 1234"}


# ----------------- WebSocket Route ----------------- #
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# ----------------- Static Files & Single Page App Serving ----------------- #
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Campus Tuck Shop & Canteen Kart API is running."}

@app.get("/{filename}")
def serve_frontend_root_file(filename: str):
    file_path = FRONTEND_DIR / filename
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
