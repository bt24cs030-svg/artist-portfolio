

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { pool, testConnection } = require('./database/db');
const { authenticateToken, isAdmin } = require('./middleware/auth');
const { validateRegister, validateArtwork, validateOrder, validateReview } = require('./utils/validation');
const { addToBlacklist, isBlacklisted } = require('./utils/blacklist');

dotenv.config();

// Check required environment variables
if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is not defined in .env file');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ========== RATE LIMITING ==========
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    skipSuccessfulRequests: true
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts, please try again later.' }
});

// ========== CORS CONFIGURATION ==========
const allowedOrigins = (process.env.CLIENT_URL || 'http://127.0.0.1:5500,http://localhost:5500').split(',');

// ========== MIDDLEWARE ==========
app.use(helmet());
// Better logging based on environment
if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/api/', limiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// ========== CREATE TABLES ==========
const createTables = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS artists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            artist_id VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            category VARCHAR(50),
            availability VARCHAR(200),
            bio TEXT,
            image_data LONGTEXT,
            website VARCHAR(255),
            rating DECIMAL(3,1) DEFAULT 0,
            review_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS artworks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            artwork_id VARCHAR(100) UNIQUE NOT NULL,
            artist_id VARCHAR(100) NOT NULL,
            title VARCHAR(200) NOT NULL,
            category VARCHAR(50),
            price INT NOT NULL,
            image_url TEXT,
            image_data LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (artist_id) REFERENCES artists(artist_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) UNIQUE NOT NULL,
            payment_id VARCHAR(100),
            artist_id VARCHAR(100),
            total_amount INT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) NOT NULL,
            artwork_id VARCHAR(100),
            artwork_title VARCHAR(200),
            quantity INT DEFAULT 1,
            price INT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            artist_id VARCHAR(100) NOT NULL,
            user_name VARCHAR(100),
            rating INT,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (artist_id) REFERENCES artists(artist_id) ON DELETE CASCADE
        )`
    ];

    for (const query of queries) {
        try {
            await pool.query(query);
        } catch (error) {
            console.error('Error creating table:', error.message);
        }
    }
    console.log('✅ Database tables ready');
};

// ========== API ENDPOINTS ==========
// 1. Test API
app.get('/api/test', (req, res) => {
    res.json({ message: 'ArtHub API is running!', status: 'success', time: new Date().toISOString() });
});

// 2. Register Artist
app.post('/api/register', async (req, res) => {
    try {
        const validation = validateRegister(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const { name, email, password, phone, category, availability, bio, imageData, website } = req.body;

        // Check if email exists
        const [existing] = await pool.query('SELECT * FROM artists WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate artist ID with UUID
        const artistId = 'ART_' + uuidv4();

        // Insert artist
        const query = `INSERT INTO artists (artist_id, name, email, password, phone, category, availability, bio, image_data, website) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await pool.query(query, [artistId, name, email, hashedPassword, phone, category, availability, bio, imageData, website]);

        res.json({
            success: true,
            artistId: artistId,
            message: 'Registration successful! Please login.'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Login Artist
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [artists] = await pool.query('SELECT * FROM artists WHERE email = ?', [email]);

        if (artists.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const artist = artists[0];

        // ✅ FIX: Check if password is bcrypt hashed or plain text
        let isValid = false;
        
        // If password starts with $2a$ or $2b$, it's bcrypt hashed
        if (artist.password && (artist.password.startsWith('$2a$') || artist.password.startsWith('$2b$'))) {
            isValid = await bcrypt.compare(password, artist.password);
        } else {
            // Plain text comparison (for demo data)
            // isValid = (password === artist.password);
             isValid = await bcrypt.compare(password, artist.password);
        }

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token with role
        const token = jwt.sign(
            { 
                artistId: artist.artist_id, 
                email: artist.email, 
                name: artist.name,
                role: artist.role || 'user'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        delete artist.password;

        res.json({
            success: true,
            token,
            artist: {
                artistId: artist.artist_id,
                name: artist.name,
                email: artist.email,
                category: artist.category,
                availability: artist.availability,
                bio: artist.bio,
                imageData: artist.image_data,
                phone: artist.phone,
                website: artist.website,
                rating: artist.rating,
                reviewCount: artist.review_count,
                role: artist.role || 'user'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Get All Artists (Public) with Pagination
app.get('/api/artists', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [artists] = await pool.query(
            `SELECT artist_id, name, category, availability, bio, image_data, rating, review_count 
             FROM artists ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [total] = await pool.query('SELECT COUNT(*) as count FROM artists');

        res.json({
            data: artists,
            pagination: {
                page,
                limit,
                total: total[0].count,
                pages: Math.ceil(total[0].count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Get Artist by ID (Public)
app.get('/api/artists/:artistId', async (req, res) => {
    try {
        const { artistId } = req.params;
        const [artists] = await pool.query('SELECT * FROM artists WHERE artist_id = ?', [artistId]);

        if (artists.length === 0) {
            return res.status(404).json({ error: 'Artist not found' });
        }

        const artist = artists[0];
        delete artist.password;
        res.json(artist);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Update Artist Profile (Protected)
app.put('/api/artists/:artistId', authenticateToken, async (req, res) => {
    try {
        const { artistId } = req.params;

        // Check if user is updating their own profile
        if (req.user.artistId !== artistId) {
            return res.status(403).json({ error: 'You can only update your own profile' });
        }

        const { name, bio, availability, phone, website, imageData } = req.body;

        const query = `UPDATE artists SET name = ?, bio = ?, availability = ?, phone = ?, website = ?, image_data = ? 
                       WHERE artist_id = ?`;

        await pool.query(query, [name, bio, availability, phone, website, imageData, artistId]);
        res.json({ success: true, message: 'Profile updated' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Upload Artwork (Protected)
app.post('/api/artworks', authenticateToken, async (req, res) => {
    try {
        const validation = validateArtwork(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const { artworkId, artistId, title, category, price, imageUrl, imageData } = req.body;

        // Check if user is uploading for themselves
        if (req.user.artistId !== artistId) {
            return res.status(403).json({ error: 'You can only upload artworks for yourself' });
        }

        // Generate UUID if artworkId not provided
        const finalArtworkId = artworkId || 'AW_' + uuidv4();

        const query = `INSERT INTO artworks (artwork_id, artist_id, title, category, price, image_url, image_data) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;

        await pool.query(query, [finalArtworkId, artistId, title, category, price, imageUrl, imageData]);
        res.json({ success: true, artworkId: finalArtworkId });

    } catch (error) {
        console.error('Upload artwork error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 8. Get Artworks by Artist (Public) with Pagination
app.get('/api/artworks/artist/:artistId', async (req, res) => {
    try {
        const { artistId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [artworks] = await pool.query(
            'SELECT * FROM artworks WHERE artist_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [artistId, limit, offset]
        );

        const [total] = await pool.query('SELECT COUNT(*) as count FROM artworks WHERE artist_id = ?', [artistId]);

        res.json({
            data: artworks,
            pagination: {
                page,
                limit,
                total: total[0].count,
                pages: Math.ceil(total[0].count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. Get All Artworks (Public) with Pagination, Search, Filter
app.get('/api/artworks', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { q, category, minPrice, maxPrice } = req.query;

        let query = `SELECT a.*, ar.name as artist_name, ar.artist_id 
                     FROM artworks a 
                     LEFT JOIN artists ar ON a.artist_id = ar.artist_id 
                     WHERE 1=1`;
        const params = [];

        // Search functionality
        if (q) {
            query += ` AND (a.title LIKE ? OR ar.name LIKE ?)`;
            params.push(`%${q}%`, `%${q}%`);
        }
        if (category) {
            query += ` AND a.category = ?`;
            params.push(category);
        }
        if (minPrice) {
            query += ` AND a.price >= ?`;
            params.push(minPrice);
        }
        if (maxPrice) {
            query += ` AND a.price <= ?`;
            params.push(maxPrice);
        }

        query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [artworks] = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as count FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.artist_id WHERE 1=1`;
        const countParams = [];
        if (q) {
            countQuery += ` AND (a.title LIKE ? OR ar.name LIKE ?)`;
            countParams.push(`%${q}%`, `%${q}%`);
        }
        if (category) {
            countQuery += ` AND a.category = ?`;
            countParams.push(category);
        }
        if (minPrice) {
            countQuery += ` AND a.price >= ?`;
            countParams.push(minPrice);
        }
        if (maxPrice) {
            countQuery += ` AND a.price <= ?`;
            countParams.push(maxPrice);
        }

        const [total] = await pool.query(countQuery, countParams);

        res.json({
            data: artworks,
            pagination: {
                page,
                limit,
                total: total[0].count,
                pages: Math.ceil(total[0].count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. Create Order (Protected) with UUID
app.post('/api/orders', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { orderId, paymentId, items, totalAmount } = req.body;

        // Validate order
        const validation = validateOrder(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Check if all items belong to same artist
        let artistId = null;
        for (const item of items) {
            const [artwork] = await connection.query('SELECT artist_id FROM artworks WHERE artwork_id = ?', [item.id]);
            if (!artwork[0]) {
                return res.status(400).json({ error: `Artwork ${item.id} not found` });
            }
            if (artistId === null) {
                artistId = artwork[0].artist_id;
            } else if (artistId !== artwork[0].artist_id) {
                return res.status(400).json({ error: 'All items must be from same artist' });
            }
        }

        // Generate UUID if orderId not provided
        const finalOrderId = orderId || 'ORD_' + uuidv4();

        // Insert order
        await connection.query(
            'INSERT INTO orders (order_id, payment_id, artist_id, total_amount, status) VALUES (?, ?, ?, ?, "pending")',
            [finalOrderId, paymentId, artistId, totalAmount]
        );

        // Insert order items
        for (const item of items) {
            await connection.query(
                'INSERT INTO order_items (order_id, artwork_id, artwork_title, quantity, price) VALUES (?, ?, ?, ?, ?)',
                [finalOrderId, item.id, item.title, item.quantity, item.price]
            );
        }

        await connection.commit();
        res.json({ success: true, orderId: finalOrderId });

    } catch (error) {
        await connection.rollback();
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    } finally {
        connection.release();
    }
});

// 11. Update Order Status (Protected - Admin only or Artist can update own orders)
app.put('/api/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ') });
        }

        // Check if order exists
        const [order] = await pool.query(
            'SELECT order_id, artist_id, status FROM orders WHERE order_id = ?',
            [orderId]
        );

        if (order.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check permission: Admin can update any order, Artist can update their own orders
        const isAdmin = req.user.role === 'admin';
        const isOwner = req.user.artistId === order[0].artist_id;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'You can only update your own orders' });
        }

        const currentStatus = order[0].status;
        const blockedStatuses = ['delivered', 'cancelled'];

        if (blockedStatuses.includes(currentStatus)) {
            return res.status(400).json({
                error: `Cannot change status of ${currentStatus} order. Order is already ${currentStatus}.`
            });
        }

        // Update order status
        await pool.query(
            'UPDATE orders SET status = ? WHERE order_id = ?',
            [status, orderId]
        );

        console.log(`✅ Order ${orderId} status updated: ${currentStatus} → ${status} by ${req.user.email}`);

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            order: {
                orderId: orderId,
                previousStatus: currentStatus,
                newStatus: status,
                updatedBy: req.user.email
            }
        });

    } catch (error) {
        console.error('Order status update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 12. Add Review (Public)
app.post('/api/reviews', async (req, res) => {
    try {
        const validation = validateReview(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const { artistId, userName, rating, comment } = req.body;

        await pool.query(
            'INSERT INTO reviews (artist_id, user_name, rating, comment) VALUES (?, ?, ?, ?)',
            [artistId, userName, rating, comment]
        );

        // Update artist rating
        await pool.query(
            `UPDATE artists SET 
                rating = (SELECT AVG(rating) FROM reviews WHERE artist_id = ?),
                review_count = (SELECT COUNT(*) FROM reviews WHERE artist_id = ?)
             WHERE artist_id = ?`,
            [artistId, artistId, artistId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 13. Get Artist Reviews (Public)
app.get('/api/reviews/:artistId', async (req, res) => {
    try {
        const { artistId } = req.params;
        const [reviews] = await pool.query(
            'SELECT * FROM reviews WHERE artist_id = ? ORDER BY created_at DESC',
            [artistId]
        );
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 14. Get Dashboard Stats (Protected)
app.get('/api/dashboard/:artistId', authenticateToken, async (req, res) => {
    try {
        const { artistId } = req.params;

        if (req.user.artistId !== artistId) {
            return res.status(403).json({ error: 'You can only view your own dashboard' });
        }

        // Total artworks count
        const [artworks] = await pool.query(
            'SELECT COUNT(*) as count FROM artworks WHERE artist_id = ?',
            [artistId]
        );

        // ✅ FIX: Total income from artworks (not orders)
        const [artworksIncome] = await pool.query(
            'SELECT COALESCE(SUM(price), 0) as total_income FROM artworks WHERE artist_id = ?',
            [artistId]
        );

        // Pending orders
        const [pendingOrders] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE artist_id = ? AND status = "pending"',
            [artistId]
        );

        // Reviews
        const [reviews] = await pool.query(
            'SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count FROM reviews WHERE artist_id = ?',
            [artistId]
        );

        res.json({
            totalArtworks: artworks[0].count || 0,
            totalIncome: artworksIncome[0].total_income || 0,
            pendingOrders: pendingOrders[0].count || 0,
            avgRating: parseFloat(reviews[0].avg_rating) || 0,
            reviewCount: reviews[0].review_count || 0
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 15. Delete Artwork (Protected)
app.delete('/api/artworks/:artworkId', authenticateToken, async (req, res) => {
    try {
        const { artworkId } = req.params;

        // Check if artwork belongs to the user
        const [artworks] = await pool.query('SELECT artist_id FROM artworks WHERE artwork_id = ?', [artworkId]);
        if (artworks.length > 0 && artworks[0].artist_id !== req.user.artistId) {
            return res.status(403).json({ error: 'You can only delete your own artworks' });
        }

        await pool.query('DELETE FROM artworks WHERE artwork_id = ?', [artworkId]);
        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        addToBlacklist(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
});

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// ========== START SERVER ==========
const startServer = async () => {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
        console.error('❌ Cannot start server without database connection');
        process.exit(1);
    }

    // Create tables
    await createTables();

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 ArtHub Backend Server Running on http://localhost:${PORT}`);
        console.log(`📡 API Test URL: http://localhost:${PORT}/api/test`);
        console.log(`🔒 Protected routes require JWT token in Authorization header`);
    });
};

startServer();