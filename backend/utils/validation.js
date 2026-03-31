const validateRegister = (data) => {
    const { name, email, password, category } = data;
    
    if (!name || name.trim() === '') {
        return { valid: false, error: 'Name is required' };
    }
    if (!email || !email.includes('@')) {
        return { valid: false, error: 'Valid email is required' };
    }
    if (!password || password.length < 4) {
        return { valid: false, error: 'Password must be at least 4 characters' };
    }
    if (!category) {
        return { valid: false, error: 'Category is required' };
    }
    
    return { valid: true };
};

const validateArtwork = (data) => {
    const { title, price } = data;
    
    if (!title || title.trim() === '') {
        return { valid: false, error: 'Title is required' };
    }
    if (!price || price <= 0) {
        return { valid: false, error: 'Valid price is required' };
    }
    
    return { valid: true };
};
// Add these validation functions
const validateOrder = (data) => {
    const { items, totalAmount } = data;
    
    if (!items || items.length === 0) {
        return { valid: false, error: 'No items in order' };
    }
    if (!totalAmount || totalAmount <= 0) {
        return { valid: false, error: 'Invalid total amount' };
    }
    
    return { valid: true };
};

const validateReview = (data) => {
    const { rating, comment } = data;
    
    if (!rating || rating < 1 || rating > 5) {
        return { valid: false, error: 'Rating must be between 1 and 5' };
    }
    if (!comment || comment.trim() === '') {
        return { valid: false, error: 'Review comment is required' };
    }
    
    return { valid: true };
};

module.exports = { validateRegister, validateArtwork, validateOrder, validateReview };