const express = require('express');
const cors = require('cors');
const supabase = require('../config/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const app = express();

// CORS configuration
const allowedOrigins = [
    'https://expert-eprocure-gem.vercel.app',
    'https://experteprocuregem-admin.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('vercel.app')) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all for now during development
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Expert Eprocure GeM API',
        supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    });
});

// Debug endpoint to check environment configuration
app.get('/api/debug', (req, res) => {
    res.json({
        supabase_url: process.env.SUPABASE_URL ? 'SET (' + process.env.SUPABASE_URL.substring(0, 30) + '...)' : 'NOT SET',
        supabase_anon: process.env.SUPABASE_ANON_KEY ? 'SET (length: ' + process.env.SUPABASE_ANON_KEY.length + ')' : 'NOT SET',
        supabase_service: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'NOT SET',
        jwt_secret: process.env.JWT_SECRET ? 'SET' : 'NOT SET'
    });
});

// ============================================
// CONTACT FORM ENDPOINTS
// ============================================

// Submit contact form (public)
app.post('/api/contacts/submit', async (req, res) => {
    try {
        const {
            name, email, phone, company, service_interest, message, source_page
        } = req.body;

        // Validation
        if (!name || !email || !service_interest || !message) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, email, service_interest, message'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Get client info
        const ip_address = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        const user_agent = req.headers['user-agent'] || 'unknown';

        // Insert into Supabase
        const { data, error } = await supabase
            .from('contacts')
            .insert([{
                name,
                email,
                phone: phone || null,
                company: company || null,
                service_interest,
                message,
                source_page: source_page || null,
                ip_address,
                user_agent,
                is_read: false,
                follow_up_status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw new Error('Database error: ' + error.message);
        }

        console.log(`✓ Contact submitted: ID ${data.id} - ${name} (${email})`);

        res.status(201).json({
            success: true,
            message: 'Thank you! We will contact you within 24 hours.',
            contact_id: data.id,
            timestamp: data.created_at
        });

    } catch (error) {
        console.error('Contact submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting contact. Please try again.'
        });
    }
});

// ============================================
// ADMIN AUTHENTICATION
// ============================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Check against admin_users table
        const { data: user, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('is_active', true)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        await supabase
            .from('admin_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// ============================================
// ADMIN CONTACTS MANAGEMENT
// ============================================

// Get all contacts (admin only)
app.get('/api/admin/contacts', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('contacts')
            .select('*', { count: 'exact' });

        // Apply filters
        if (status === 'unread') {
            query = query.eq('is_read', false);
        } else if (status === 'read') {
            query = query.eq('is_read', true);
        } else if (status === 'pending') {
            query = query.eq('follow_up_status', 'pending');
        }

        // Search filter
        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
        }

        // Pagination and ordering
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) {
            throw new Error(error.message);
        }

        res.json({
            success: true,
            data,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get single contact (admin only)
app.get('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        // Mark as read
        if (!data.is_read) {
            await supabase
                .from('contacts')
                .update({ is_read: true, updated_at: new Date().toISOString() })
                .eq('id', id);
        }

        res.json({
            success: true,
            data: { ...data, is_read: true }
        });

    } catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update contact (admin only)
app.put('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { assigned_to, notes, follow_up_status, follow_up_date, is_read } = req.body;

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (assigned_to !== undefined) updates.assigned_to = assigned_to;
        if (notes !== undefined) updates.notes = notes;
        if (follow_up_status !== undefined) updates.follow_up_status = follow_up_status;
        if (follow_up_date !== undefined) updates.follow_up_date = follow_up_date;
        if (is_read !== undefined) updates.is_read = is_read;

        const { data, error } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete contact (admin only)
app.delete('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(error.message);
        }

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// Get analytics summary (admin only)
app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
    try {
        // Total contacts
        const { count: totalContacts } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });

        // Unread contacts
        const { count: unreadCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);

        // This month's contacts
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: thisMonth } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString());

        // Service breakdown
        const { data: serviceData } = await supabase
            .from('contacts')
            .select('service_interest');

        const serviceBreakdown = {};
        serviceData?.forEach(item => {
            if (item.service_interest) {
                serviceBreakdown[item.service_interest] = (serviceBreakdown[item.service_interest] || 0) + 1;
            }
        });

        // Conversion rate (assigned contacts / total)
        const { count: assignedCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .not('assigned_to', 'is', null);

        const conversionRate = totalContacts > 0
            ? ((assignedCount / totalContacts) * 100).toFixed(1)
            : 0;

        res.json({
            success: true,
            data: {
                total_contacts: totalContacts || 0,
                unread_count: unreadCount || 0,
                this_month: thisMonth || 0,
                conversion_rate: parseFloat(conversionRate),
                service_breakdown: Object.entries(serviceBreakdown).map(([service, count]) => ({
                    service,
                    count
                })).sort((a, b) => b.count - a.count)
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// ============================================
// TICKETS - PUBLIC ENDPOINTS
// ============================================
app.post('/api/tickets/submit', async (req, res) => {
    try {
        const { name, email, phone, subject, category, priority, description } = req.body;
        if (!name || !email || !subject || !description) {
            return res.status(400).json({ success: false, message: 'Name, email, subject, and description are required' });
        }
        // Generate ticket ID: TKT-YYYYMMDD-XXX
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
        const ticket_id = `TKT-${dateStr}-${random}`;

        const { data, error } = await supabase.from('tickets').insert([{
            ticket_id, name, email, phone: phone || null,
            subject, category: category || 'Other',
            priority: priority || 'medium', description,
            status: 'open'
        }]).select();
        if (error) throw error;
        res.json({ success: true, message: 'Ticket submitted successfully', ticket_id, data: data[0] });
    } catch (error) {
        console.error('Ticket submit error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to submit ticket' });
    }
});

app.get('/api/tickets/status/:ticketId', async (req, res) => {
    try {
        const { data, error } = await supabase.from('tickets')
            .select('ticket_id, subject, category, priority, status, admin_response, created_at, updated_at')
            .eq('ticket_id', req.params.ticketId).single();
        if (error || !data) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// TICKETS - ADMIN ENDPOINTS
// ============================================
app.get('/api/admin/tickets', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
        let query = supabase.from('tickets').select('*', { count: 'exact' });
        if (status !== 'all') query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%,ticket_id.ilike.%${search}%`);
        const offset = (page - 1) * limit;
        query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
        const { data, error, count } = await query;
        if (error) throw error;
        res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil(count / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('tickets').select('*').eq('id', req.params.id).single();
        if (error || !data) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const updates = {};
        const allowed = ['status', 'priority', 'admin_response', 'responded_by'];
        allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase.from('tickets').update(updates).eq('id', req.params.id).select();
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabase.from('tickets').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Ticket deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// BLOG - PUBLIC ENDPOINTS
// ============================================
app.get('/api/blog/posts', async (req, res) => {
    try {
        const { data, error } = await supabase.from('blog_posts')
            .select('*').eq('is_published', true)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.json({ success: true, data: [] }); // Gracefully return empty if table doesn't exist
    }
});

app.get('/api/blog/posts/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('blog_posts')
            .select('*').eq('id', req.params.id).eq('is_published', true).single();
        if (error || !data) return res.status(404).json({ success: false, message: 'Post not found' });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// BLOG - ADMIN ENDPOINTS
// ============================================
app.get('/api/admin/blog', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

app.post('/api/admin/blog', authenticateToken, async (req, res) => {
    try {
        const { title, slug, excerpt, content, category, featured_image, is_published } = req.body;
        if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });
        const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
        const { data, error } = await supabase.from('blog_posts').insert([{
            title, slug: postSlug, excerpt, content,
            category: category || null, featured_image: featured_image || null,
            is_published: is_published || false
        }]).select();
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/blog/:id', authenticateToken, async (req, res) => {
    try {
        const updates = {};
        const allowed = ['title', 'slug', 'excerpt', 'content', 'category', 'featured_image', 'is_published'];
        allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase.from('blog_posts').update(updates).eq('id', req.params.id).select();
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/blog/:id', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabase.from('blog_posts').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// GEMINI AI CHAT PROXY
// ============================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            // Fallback - provide helpful responses without Gemini
            return res.json({ success: true, reply: getOfflineReply(message) });
        }

        const systemPrompt = `You are a helpful AI assistant for Expert Eprocure GeM, a company that helps businesses register and sell on the Government e-Marketplace (GeM) in India. You specialize in:
- GeM seller registration process
- Product/service cataloging on GeM
- Bid management (L1, RA, custom bids)
- Order fulfillment and payment processes
- Compliance and documentation requirements
- MSME benefits on GeM
Keep responses concise, friendly, and focused on GeM-related topics. If asked about unrelated topics, politely redirect to GeM services. Contact: +91 95234 42474, experteprocuregem@zohomail.in`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: message }] }],
                generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
            })
        });

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not process that. Please contact us directly at +91 95234 42474.';
        res.json({ success: true, reply });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({ success: true, reply: getOfflineReply(req.body.message) });
    }
});

function getOfflineReply(message) {
    const msg = (message || '').toLowerCase();
    if (msg.includes('register') || msg.includes('registration')) {
        return '**GeM Registration Process:**\n\n• Visit gem.gov.in and click "Sign Up" as Seller\n• Provide Aadhaar, PAN, mobile for OTP verification\n• Enter business details (GST, bank account)\n• Upload documents (PAN, GST certificate)\n• Complete e-KYC verification\n\nWe can handle the entire process for you! Contact us at **+91 95234 42474** for assistance.';
    }
    if (msg.includes('document') || msg.includes('required')) {
        return '**Documents Required for GeM Registration:**\n\n• PAN Card (Individual/Business)\n• GST Registration Certificate\n• Aadhaar Card (for e-KYC)\n• Bank Account Details (cancelled cheque)\n• ITR for last 3 years (for certain categories)\n• MSME/Udyam Registration (if applicable)\n\nNeed help? Contact us at **+91 95234 42474**';
    }
    if (msg.includes('bid') || msg.includes('tender')) {
        return '**GeM Bidding Types:**\n\n• **L1 Bidding** — Lowest price wins\n• **Reverse Auction (RA)** — Real-time price competition\n• **Custom Bids** — For specialized requirements\n\nOur experts can manage your bids strategically. Call **+91 95234 42474** for bid management services.';
    }
    if (msg.includes('payment') || msg.includes('order')) {
        return '**GeM Order & Payment Process:**\n\n1. Accept order within 72 hours\n2. Ship within agreed timeline\n3. Upload CRAC (Consignee Receipt)\n4. Buyer inspection (10 days)\n5. Upload invoice\n6. Payment released within 10 days\n\nFor order fulfillment support, contact **+91 95234 42474**';
    }
    return '👋 Thanks for reaching out! I can help with:\n\n• GeM seller registration\n• Document requirements\n• Bidding strategies\n• Order fulfillment\n• Payment queries\n\nFor personalized assistance, contact our experts at **+91 95234 42474** or email **experteprocuregem@zohomail.in**';
}

// Export for Vercel
module.exports = app;

// Start server if running locally
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`✓ Expert Eprocure GeM API running on port ${PORT}`);
    });
}
