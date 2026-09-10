import json
import urllib.request
import urllib.parse

BASE_URL = "http://127.0.0.1:8000"

def request_json(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    body = json.dumps(data).encode("utf-8") if data else None
    with urllib.request.urlopen(req, data=body) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print(">>> 1. Testing GET /api/products (4 Categories)")
    products = request_json(f"{BASE_URL}/api/products")
    assert len(products) >= 12, "Expected at least 12 products"
    categories = {p["category"] for p in products}
    print(f"PASS: Found {len(products)} products across categories: {categories}")

    print("\n>>> 2. Testing POST /api/products (Create Product)")
    new_prod_data = {
        "name": "Classmate Geometry Box",
        "category": "Stationery & Supplies",
        "price": 120.0,
        "is_sold_out": False,
        "img_url": "https://images.unsplash.com/photo-1585336261026-41866443bdab?w=600",
        "description": "Mathematical instrument compass set for engineering drawing."
    }
    created_prod = request_json(f"{BASE_URL}/api/products", method="POST", data=new_prod_data)
    prod_id = created_prod["id"]
    assert created_prod["name"] == "Classmate Geometry Box"
    print(f"PASS: Created product ID #{prod_id}")

    print("\n>>> 3. Testing PUT /api/products/{id} (Update Product)")
    updated_prod = request_json(f"{BASE_URL}/api/products/{prod_id}", method="PUT", data={"price": 130.0, "is_sold_out": True})
    assert updated_prod["price"] == 130.0
    assert updated_prod["is_sold_out"] is True
    print(f"PASS: Updated product ID #{prod_id} price to 130.0 and sold_out to True")

    print("\n>>> 4. Testing POST /api/notifications (Subscribe for Restock)")
    notif_sub = request_json(f"{BASE_URL}/api/notifications", method="POST", data={"product_id": prod_id, "subscriber": "24BCSE999"})
    assert notif_sub["success"] is True
    assert "24BCSE999" in notif_sub["notification"]["subscribers"]
    print(f"PASS: Subscribed student 24BCSE999 to product #{prod_id}")

    print("\n>>> 5. Testing GET /api/notifications (Verify Waitlist)")
    notifs = request_json(f"{BASE_URL}/api/notifications")
    matched = next((n for n in notifs if n["product_id"] == prod_id), None)
    assert matched is not None, "Notification record should exist"
    print(f"PASS: Verified notification record with {len(matched['subscribers'])} subscribers")

    print("\n>>> 6. Testing POST /api/notifications/{id}/notify (Restock & Alert)")
    alert_res = request_json(f"{BASE_URL}/api/notifications/{prod_id}/notify", method="POST")
    assert alert_res["success"] is True
    # Verify product is now back in stock
    prod_check = next(p for p in request_json(f"{BASE_URL}/api/products") if p["id"] == prod_id)
    assert prod_check["is_sold_out"] is False
    print(f"PASS: Restock alerts sent, product #{prod_id} back in stock")

    print("\n>>> 7. Testing DELETE /api/products/{id} (Delete Product)")
    del_res = request_json(f"{BASE_URL}/api/products/{prod_id}", method="DELETE")
    assert del_res["success"] is True
    # Confirm it's gone
    prods_after_del = request_json(f"{BASE_URL}/api/products")
    assert not any(p["id"] == prod_id for p in prods_after_del)
    print(f"PASS: Deleted temporary product #{prod_id}")

    print("\n>>> 8. Testing POST /api/orders (Express 4-Digit Token & Dual Payment)")
    order_data = {
        "customer_name": "Rohan Mehra",
        "phone": "9876500000",
        "items": [
            {"id": 101, "name": "Classmate Long Register (200 Pgs)", "qty": 1, "price": 85.0},
            {"id": 105, "name": "Nescafe Classic Cold Coffee Frappe", "qty": 1, "price": 65.0}
        ],
        "total_amount": 150.0,
        "payment_method": "UPI"
    }
    order = request_json(f"{BASE_URL}/api/orders", method="POST", data=order_data)
    assert len(order["token"]) == 4
    assert order["payment_status"] == "Paid"
    order_id = order["order_id"]
    print(f"PASS: Created order {order_id} with token #{order['token']}")

    print("\n>>> 9. Testing PATCH /api/orders/{id} (Status Pipeline)")
    status_patch = request_json(f"{BASE_URL}/api/orders/{order_id}", method="PATCH", data={"order_status": "Ready for Counter Pickup"})
    assert status_patch["order_status"] == "Ready for Counter Pickup"
    print(f"PASS: Advanced order {order_id} to 'Ready for Counter Pickup'")

    print("\n>>> 10. Testing Admin PIN Verification")
    pin_check = request_json(f"{BASE_URL}/api/admin/verify-pin", method="POST", data={"pin": "1234"})
    assert pin_check["success"] is True
    print(f"PASS: Admin PIN verified successfully")

    print("\n>>> 11. Testing Granular Basket Packing Checklist Workflow")
    # Create an order with 3 items as specified in requirements
    packing_order_data = {
        "customer_name": "Aryan Sharma",
        "customer_phone": "9876543210",
        "items": [
            {"id": 101, "name": "Classmate Register 200 Pgs", "qty": 1, "price": 85.0},
            {"id": 102, "name": "Reynolds Blue Gel Pen", "qty": 2, "price": 20.0},
            {"id": 103, "name": "Peri Peri French Fries", "qty": 1, "price": 70.0}
        ],
        "total_amount": 175.0,
        "payment_method": "UPI"
    }
    p_order = request_json(f"{BASE_URL}/api/orders", method="POST", data=packing_order_data)
    p_order_id = p_order["order_id"]
    assert p_order["order_status"] == "Pending"
    assert len(p_order["items"]) == 3
    assert all(it["packed"] is False for it in p_order["items"]), "All new items must default to packed: false"
    print(f"PASS: Order {p_order_id} created with 3 items, all packed=False")

    # Pack Item 1 (101)
    pack_res1 = request_json(f"{BASE_URL}/api/orders/{p_order_id}/items/101/pack", method="PATCH", data={"packed": True})
    item101 = next(it for it in pack_res1["items"] if it["id"] == 101)
    assert item101["packed"] is True
    assert pack_res1["order_status"] == "Packing", "Status should auto-advance to 'Packing' when first item is packed"
    print(f"PASS: Item #101 packed -> Order auto-advanced to status: '{pack_res1['order_status']}'")

    # Pack Item 2 (102)
    pack_res2 = request_json(f"{BASE_URL}/api/orders/{p_order_id}/items/102/pack", method="PATCH", data={"packed": True})
    item102 = next(it for it in pack_res2["items"] if it["id"] == 102)
    assert item102["packed"] is True
    assert pack_res2["order_status"] == "Packing"
    print(f"PASS: Item #102 packed (2/3 items packed)")

    # Pack Item 3 (103) -> 100% packed!
    pack_res3 = request_json(f"{BASE_URL}/api/orders/{p_order_id}/items/103/pack", method="PATCH", data={"packed": True})
    assert all(it["packed"] is True for it in pack_res3["items"]), "All items must now be packed"
    assert pack_res3["order_status"] == "Ready for Counter Pickup", "Status should auto-advance to 'Ready for Counter Pickup' when 100% packed"
    print(f"PASS: Item #103 packed -> 100% packed! Order status: '{pack_res3['order_status']}'")

    # Toggle Item 103 back to unpacked (simulate student changing mind / missing item)
    unpack_res = request_json(f"{BASE_URL}/api/orders/{p_order_id}/items/103/pack", method="PATCH")
    item103_unpacked = next(it for it in unpack_res["items"] if it["id"] == 103)
    assert item103_unpacked["packed"] is False
    assert unpack_res["order_status"] == "Packing", "Status should adjust back to 'Packing' when an item is unpacked"
    print(f"PASS: Item #103 untoggled -> Order status safely adjusted back to: '{unpack_res['order_status']}'")

    print("\n>>> 12. Testing Bulk Pack All Items (/pack-all)")
    bulk_pack = request_json(f"{BASE_URL}/api/orders/{p_order_id}/pack-all", method="PATCH", data={"packed": True})
    assert all(it["packed"] is True for it in bulk_pack["items"])
    assert bulk_pack["order_status"] == "Ready for Counter Pickup"
    print(f"PASS: Bulk pack-all packed all 3 items and set status to 'Ready for Counter Pickup'")

    bulk_unpack = request_json(f"{BASE_URL}/api/orders/{p_order_id}/pack-all", method="PATCH", data={"packed": False})
    assert all(it["packed"] is False for it in bulk_unpack["items"])
    assert bulk_unpack["order_status"] == "Pending"
    print(f"PASS: Bulk pack-all unpacked all items and reset status to 'Pending'")

    print("\n>>> 13. Testing Final Handover Completion")
    final_order = request_json(f"{BASE_URL}/api/orders/{p_order_id}", method="PATCH", data={"order_status": "Handed Over"})
    assert final_order["order_status"] == "Handed Over"
    print(f"PASS: Completed order {p_order_id} marked as 'Handed Over'")

    print("\n=======================================================")
    print("ALL 13 CAMPUS TUCK SHOP & BASKET PACKING TESTS PASSED 100%!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
