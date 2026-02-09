// Configuration
const CONFIG = {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    API_ENDPOINT: 'https://your-backend-api.com/api/aspirations',
    ITEMS_PER_PAGE: 6
};

// Database simulation for ACode (using localStorage)
class AspirationDB {
    constructor() {
        this.STORAGE_KEY = 'dewap_aspirations';
        this.TRACKING_KEY = 'dewap_tracking';
        this.initDatabase();
    }

    initDatabase() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            const initialData = {
                aspirations: [],
                nextId: 1,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
        }
    }

    generateTrackingCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'DAGM-';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async saveAspiration(data) {
        try {
            const db = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            const trackingCode = this.generateTrackingCode();
            const timestamp = new Date().toISOString();
            
            const aspiration = {
                id: db.nextId++,
                trackingCode,
                name: data.anonim ? 'Anonim' : data.name,
                email: data.email,
                phone: data.phone || '',
                department: data.department,
                category: data.category,
                message: data.message,
                attachment: data.attachment || null,
                status: 'pending',
                createdAt: timestamp,
                updatedAt: timestamp,
                ipAddress: await this.getClientIP(),
                userAgent: navigator.userAgent
            };

            db.aspirations.unshift(aspiration);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(db));
            
            // Save tracking code for easy access
            const trackingData = {
                code: trackingCode,
                email: data.email,
                createdAt: timestamp
            };
            this.saveTrackingCode(trackingCode, trackingData);

            return {
                success: true,
                trackingCode,
                message: 'Aspirasi berhasil dikirim!'
            };
        } catch (error) {
            console.error('Save error:', error);
            return {
                success: false,
                message: 'Terjadi kesalahan saat menyimpan data.'
            };
        }
    }

    saveTrackingCode(code, data) {
        let tracking = JSON.parse(localStorage.getItem(this.TRACKING_KEY)) || {};
        tracking[code] = data;
        localStorage.setItem(this.TRACKING_KEY, JSON.stringify(tracking));
    }

    getTrackingInfo(code) {
        const tracking = JSON.parse(localStorage.getItem(this.TRACKING_KEY)) || {};
        return tracking[code] || null;
    }

    getAspirations(filter = 'all', page = 1) {
        const db = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
        let filtered = db.aspirations;

        if (filter !== 'all') {
            filtered = filtered.filter(item => item.category === filter);
        }

        const start = (page - 1) * CONFIG.ITEMS_PER_PAGE;
        const end = start + CONFIG.ITEMS_PER_PAGE;
        const paginated = filtered.slice(start, end);

        return {
            data: paginated,
            total: filtered.length,
            page,
            totalPages: Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE)
        };
    }

    getAspirationByCode(code) {
        const db = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
        return db.aspirations.find(item => item.trackingCode === code);
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    // Security: Input sanitization
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    validatePhone(phone) {
        if (!phone) return true;
        const re = /^[0-9+\-\s()]{10,15}$/;
        return re.test(phone);
    }
}

// File validation
function validateFile(file) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        return {
            valid: false,
            message: 'Ukuran file terlalu besar. Maksimal 5MB.'
        };
    }

    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
        return {
            valid: false,
            message: 'Format file tidak didukung. Gunakan PDF, JPG, PNG, atau DOC.'
        };
    }

    return { valid: true };
}

// Form submission
async function submitAspirationForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('#submitBtn');
    const submitText = form.querySelector('#submitText');
    const spinner = form.querySelector('#spinner');
    const messageDiv = form.querySelector('#formMessage');
    
    // Get form data
    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        department: document.getElementById('department').value,
        category: document.getElementById('category').value,
        message: document.getElementById('message').value.trim(),
        anonim: document.getElementById('anonim').checked
    };

    // Validation
    const db = new AspirationDB();
    
    if (!formData.name && !formData.anonim) {
        showMessage(messageDiv, 'error', 'Harap isi nama lengkap atau centang anonim.');
        return;
    }

    if (!db.validateEmail(formData.email)) {
        showMessage(messageDiv, 'error', 'Email tidak valid.');
        return;
    }

    if (!db.validatePhone(formData.phone)) {
        showMessage(messageDiv, 'error', 'Nomor telepon tidak valid.');
        return;
    }

    if (!formData.department) {
        showMessage(messageDiv, 'error', 'Harap pilih departemen tujuan.');
        return;
    }

    if (!formData.category) {
        showMessage(messageDiv, 'error', 'Harap pilih kategori.');
        return;
    }

    if (formData.message.length < 10) {
        showMessage(messageDiv, 'error', 'Isi aspirasi minimal 10 karakter.');
        return;
    }

    // File validation
    const fileInput = document.getElementById('attachment');
    let attachment = null;
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const validation = validateFile(file);
        
        if (!validation.valid) {
            showMessage(messageDiv, 'error', validation.message);
            return;
        }

        // Convert file to base64 for storage
        attachment = await fileToBase64(file);
    }

    // Sanitize inputs
    formData.name = db.sanitizeInput(formData.name);
    formData.message = db.sanitizeInput(formData.message);
    if (attachment) formData.attachment = attachment;

    // Show loading state
    submitBtn.disabled = true;
    submitText.style.display = 'none';
    spinner.style.display = 'inline-block';

    try {
        // Save to database
        const result = await db.saveAspiration(formData);
        
        if (result.success) {
            showMessage(messageDiv, 'success', 
                `✅ ${result.message} Kode Tracking: <strong>${result.trackingCode}</strong>. Simpan kode ini untuk melacak status.`);
            form.reset();
            
            // Refresh aspirations list
            loadAspirations();
        } else {
            showMessage(messageDiv, 'error', result.message);
        }
    } catch (error) {
        console.error('Submission error:', error);
        showMessage(messageDiv, 'error', 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result
        });
        reader.onerror = error => reject(error);
    });
}

function showMessage(element, type, message) {
    element.innerHTML = message;
    element.className = `form-message ${type}`;
    element.style.display = 'block';
    
    // Auto hide success messages after 10 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 10000);
    }
}

// Track aspiration
function trackAspiration() {
    const codeInput = document.getElementById('trackingCode');
    const resultDiv = document.getElementById('trackingResult');
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        resultDiv.innerHTML = '<div class="form-message error">Harap masukkan kode tracking.</div>';
        return;
    }

    const db = new AspirationDB();
    const aspiration = db.getAspirationByCode(code);
    
    if (!aspiration) {
        resultDiv.innerHTML = '<div class="form-message error">Kode tracking tidak ditemukan.</div>';
        return;
    }

    const statusText = {
        'pending': 'Menunggu',
        'process': 'Diproses',
        'done': 'Selesai'
    }[aspiration.status] || aspiration.status;

    const statusClass = {
        'pending': 'status-pending',
        'process': 'status-process',
        'done': 'status-done'
    }[aspiration.status] || '';

    const date = new Date(aspiration.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    resultDiv.innerHTML = `
        <div class="tracking-result">
            <h4>Status Aspirasi: <span class="${statusClass}">${statusText}</span></h4>
            <p><strong>Departemen:</strong> ${aspiration.department}</p>
            <p><strong>Kategori:</strong> ${aspiration.category}</p>
            <p><strong>Tanggal:</strong> ${date}</p>
            <p><strong>Pesan:</strong> ${aspiration.message.substring(0, 100)}${aspiration.message.length > 100 ? '...' : ''}</p>
        </div>
    `;
}

// Load and display aspirations
let currentPage = 1;
let currentFilter = 'all';

async function loadAspirations(append = false) {
    if (!append) {
        currentPage = 1;
        document.getElementById('aspirationsList').innerHTML = '';
    }

    const db = new AspirationDB();
    const result = db.getAspirations(currentFilter, currentPage);
    
    const listContainer = document.getElementById('aspirationsList');
    
    if (result.data.length === 0 && currentPage === 1) {
        listContainer.innerHTML = '<div class="no-data">Belum ada aspirasi yang ditampilkan.</div>';
        document.getElementById('loadMoreBtn').style.display = 'none';
        return;
    }

    result.data.forEach(aspiration => {
        const item = createAspirationItem(aspiration);
        if (append) {
            listContainer.appendChild(item);
        } else {
            listContainer.insertAdjacentHTML('beforeend', item.outerHTML);
        }
    });

    // Show/hide load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (currentPage < result.totalPages) {
        loadMoreBtn.style.display = 'inline-block';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

function createAspirationItem(aspiration) {
    const item = document.createElement('div');
    item.className = 'aspiration-item';
    
    const date = new Date(aspiration.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    
    const statusText = {
        'pending': 'Menunggu',
        'process': 'Diproses',
        'done': 'Selesai'
    }[aspiration.status] || aspiration.status;
    
    const statusClass = {
        'pending': 'status-pending',
        'process': 'status-process',
        'done': 'status-done'
    }[aspiration.status] || '';
    
    const initial = aspiration.name.charAt(0).toUpperCase();
    
    item.innerHTML = `
        <div class="aspiration-header">
            <span class="aspiration-category">${aspiration.category}</span>
            <span class="aspiration-department">
                <i class="fas fa-building"></i> ${aspiration.department}
            </span>
        </div>
        <div class="aspiration-content">
            <p>${aspiration.message.length > 150 ? aspiration.message.substring(0, 150) + '...' : aspiration.message}</p>
        </div>
        <div class="aspiration-footer">
            <div class="aspiration-author">
                <div class="author-avatar">${initial}</div>
                <div>
                    <div class="author-name">${aspiration.name}</div>
                    <div class="aspiration-date">${date}</div>
                </div>
            </div>
            <div class="aspiration-status ${statusClass}">${statusText}</div>
        </div>
    `;
    
    return item;
}

// Filter aspirations
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update filter and reload
            currentFilter = this.dataset.filter;
            currentPage = 1;
            loadAspirations();
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Initialize database
    const db = new AspirationDB();
    
    // Setup form submission
    const form = document.getElementById('aspirationForm');
    if (form) {
        form.addEventListener('submit', submitAspirationForm);
    }
    
    // Setup filter buttons
    setupFilterButtons();
    
    // Load initial aspirations
    loadAspirations();
    
    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            currentPage++;
            loadAspirations(true);
        });
    }
    
    // Auto-hide messages after 5 seconds
    setTimeout(() => {
        const messages = document.querySelectorAll('.form-message');
        messages.forEach(msg => {
            if (msg.classList.contains('success')) {
                msg.style.display = 'none';
            }
        });
    }, 5000);
});