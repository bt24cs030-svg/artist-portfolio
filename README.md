# 🎨 ArtHub - Artist Portfolio Platform

A full stack web application where artists can showcase 
their portfolios, sell artworks, and manage commissions.

---

## 🚀 Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- MySQL
- JWT Authentication
- bcrypt (password hashing)

---

## ✨ Features

- 👤 Artist Registration & Login
- 🔐 Secure Authentication using JWT
- 🎨 Portfolio Galleries (Artwork, Music, Photography, Video)
- 🛒 E-commerce Support for Artwork Sales
- 📥 Digital Downloads
- 💰 Commission Request & Pricing Module
- 📅 Availability & Booking Status
- 📩 Client Inquiries System
- ⭐ Reviews & Ratings System
- 📊 Artist Dashboard
- 🔍 Search & Filter Artworks
- 🗂️ Category & Collection Management
- ⚡ Pagination Support
- 🛡️ Security (Helmet, Rate Limiting)

---

## 📂 Project Structure
artist-portfolio/
├── Frontend/          # HTML, CSS, JS files
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── ...
├── backend/           # Node.js backend
│   └── ...
└── README.md

---

## 📂 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/register | Register artist |
| POST | /api/login | Login |
| GET | /api/artists | Get all artists |
| POST | /api/artworks | Upload artwork |
| POST | /api/orders | Create order |

---

## ⚙️ Setup Instructions

### Step 1 - Clone the repository
```bash
git clone https://github.com/bt24cs030-svg/artist-portfolio.git
cd artist-portfolio
```

### Step 2 - Install dependencies
```bash
cd backend
npm install
```

### Step 3 - Setup MySQL database
```sql
CREATE DATABASE arthub;
```

### Step 4 - Configure environment
Create a `.env` file in backend folder:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=arthub
JWT_SECRET=yoursecretkey

### Step 5 - Run the server
```bash
node server.js
```

### Step 6 - Open frontend
Open `Frontend/index.html` in your browser!

---

## 👨‍💻 Developer

- **Name:** Madhurendra kumar
- **College:** NIT Mizoram
- **Branch:** CSE
- **Semester:** 4th

---

## 📄 License
This project is for educational purposes.
