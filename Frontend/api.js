// API Configuration
const API_URL = 'http://localhost:3001/api';

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const token = sessionStorage.getItem('token');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Something went wrong');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ========== AUTHENTICATION ==========
export async function registerArtist(artistData) {
    return await apiCall('/register', 'POST', artistData);
}

export async function loginArtist(email, password) {
    return await apiCall('/login', 'POST', { email, password });
}

// ========== ARTISTS ==========
export async function getAllArtists() {
    const result = await apiCall('/artists');
    // Handle both array and paginated response
    if (result && result.data) {
        return result.data;
    }
    return result;
}

export async function getArtistById(artistId) {
    return await apiCall(`/artists/${artistId}`);
}

export async function updateArtist(artistId, data) {
    return await apiCall(`/artists/${artistId}`, 'PUT', data);
}

// ========== ARTWORKS ==========
export async function uploadArtwork(artworkData) {
    return await apiCall('/artworks', 'POST', artworkData);
}

export async function getAllArtworks() {
    const result = await apiCall('/artworks');
    // Handle both array and paginated response
    if (result && result.data) {
        return result.data;
    }
    return result;
}

export async function getArtistArtworks(artistId) {
    const result = await apiCall(`/artworks/artist/${artistId}`);
    if (result && result.data) {
        return result.data;
    }
    return result;
}

export async function deleteArtwork(artworkId) {
    return await apiCall(`/artworks/${artworkId}`, 'DELETE');
}

// ========== ORDERS ==========
export async function createOrder(orderData) {
    return await apiCall('/orders', 'POST', orderData);
}

// ========== REVIEWS ==========
export async function addReview(reviewData) {
    return await apiCall('/reviews', 'POST', reviewData);
}

export async function getArtistReviews(artistId) {
    return await apiCall(`/reviews/${artistId}`);
}

// ========== DASHBOARD ==========
export async function getDashboardStats(artistId) {
    return await apiCall(`/dashboard/${artistId}`);
}