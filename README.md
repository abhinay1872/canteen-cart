# GGI TuckShop - Essentials & Canteen Cart

A modern, full-stack campus tuck shop & canteen ordering platform built with **FastAPI**, **Vanilla HTML5/CSS3/ES6+ JavaScript**, and **real-time WebSocket synchronization**.

Designed to eradicate tuck shop counter rush between lectures by enabling students to pre-order college essentials, stationery, snacks, and beverages, pay instantly via dynamic UPI QR or counter cash, flash a unique 4-digit pickup token, and watch line-item basket packing progress in real time.

---

## 🌟 Key Features

- 🎟️ **Express 4-Digit Pickup Token**: Immutable, non-repeating pickup token generated with every order.
- 📦 **Live Basket Packing & Checklist System**: Real-time line-item checklist between Shopkeeper Admin KDS and the Student Digital Pickup Pass.
- ⚡ **Dual Payment Modes**: Contactless Dynamic UPI QR Pay and Pay-at-Counter option.
- 📊 **Shopkeeper KDS & Admin Hub**: PIN-protected operations center (`Default PIN: 1234`) with active order queues, live inventory CRUD, and restock waitlist triggers.
- 🔔 **"Notify Me" Restock Engine**: Students can register their phone or roll number for sold-out supplies.
- 🌐 **Public & Local Network Ready**: Binds to `0.0.0.0:8000` with automatic local IP detection and Cloudflare tunnel support.

---

## 🛠️ Technology Stack

- **Frontend**: Semantic HTML5, CSS Grid & Flexbox, Vanilla CSS3 (glassmorphism, micro-animations), Modular ES6+ JavaScript.
- **Backend**: Python 3.10+ / FastAPI, Uvicorn, WebSockets.
- **Persistence**: Structured JSON storage (`products.json`, `orders.json`, `notifications.json`).

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/canteen-kart.git
cd canteen-kart
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Server
```bash
python run.py
```

- **Local Web App**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Local Network (Wi-Fi)**: `http://<your-local-ip>:8000`
- **Shopkeeper Admin PIN**: `1234`

### 4. Run Automated Test Suite
```bash
python test_api.py
```

---

## 📂 Project Structure

```
├── backend/
│   ├── app.py                  # FastAPI REST API, WebSocket hub & static server
│   └── data/
│       ├── products.json       # Product catalog & stock state
│       ├── orders.json         # Order pipeline & line-item packing states
│       └── notifications.json  # Restock waitlist subscribers
├── frontend/
│   ├── index.html              # Student portal & Shopkeeper KDS views
│   ├── style.css               # Responsive design system & micro-animations
│   └── app.js                  # State management, cart, UPI QR, and real-time sync
├── requirements.txt            # Python dependencies
├── run.py                      # Multi-interface network launcher
├── test_api.py                 # Integration test suite (13 test scenarios)
└── README.md
```

---

## 📄 License
MIT License. Free for academic, campus, and personal use.
