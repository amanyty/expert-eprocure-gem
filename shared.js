// ========== Shared JavaScript for Expert Eprocure GeM ==========
const API_URL = 'https://expert-eprocure-gem-app1.vercel.app';

// ========== Mobile Menu ==========
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
        });

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
            });
        });
    }

    // Header scroll effect
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    // Mark active nav link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.card, .animate-on-scroll').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Initialize chatbot
    initChatbot();
});

// ========== Gemini AI Chatbot ==========
function initChatbot() {
    const fab = document.getElementById('chatbotFab');
    const panel = document.getElementById('chatbotPanel');
    if (!fab || !panel) return;

    fab.addEventListener('click', () => {
        panel.classList.toggle('open');
        fab.style.display = panel.classList.contains('open') ? 'none' : 'flex';
    });

    document.getElementById('chatbotClose')?.addEventListener('click', () => {
        panel.classList.remove('open');
        fab.style.display = 'flex';
    });

    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');

    chatSend?.addEventListener('click', () => sendChatMessage());
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Suggestion buttons
    document.querySelectorAll('.chatbot-suggestions button').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value = btn.textContent;
            sendChatMessage();
        });
    });
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message
    chatMessages.innerHTML += `<div class="chat-msg user">${escapeHtml(message)}</div>`;
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg typing';
    typingEl.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Hide suggestions after first message
    const suggestions = document.querySelector('.chatbot-suggestions');
    if (suggestions) suggestions.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const result = await response.json();
        typingEl.remove();

        const botReply = result.success ? result.reply : 'Sorry, I couldn\'t process that. Please try again.';
        chatMessages.innerHTML += `<div class="chat-msg bot">${formatBotReply(botReply)}</div>`;
    } catch (err) {
        typingEl.remove();
        chatMessages.innerHTML += `<div class="chat-msg bot">I'm having trouble connecting. Please try again or contact us directly at +91 95234 42474.</div>`;
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatBotReply(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/• /g, '&bull; ');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== Shared Header HTML ==========
function getHeaderHTML(activePage) {
    return `
    <header id="header">
        <nav class="container">
            <div class="logo"><a href="index.html"><img src="logo.png" alt="Expert Eprocure GeM"></a></div>
            <ul class="nav-links" id="navLinks">
                <li><a href="index.html" ${activePage === 'home' ? 'class="active"' : ''}>Home</a></li>
                <li><a href="about.html" ${activePage === 'about' ? 'class="active"' : ''}>About</a></li>
                <li><a href="services.html" ${activePage === 'services' ? 'class="active"' : ''}>Services</a></li>
                <li><a href="blog.html" ${activePage === 'blog' ? 'class="active"' : ''}>Blog</a></li>
                <li><a href="tickets.html" ${activePage === 'tickets' ? 'class="active"' : ''}>Queries</a></li>
                <li><a href="contact.html" class="nav-cta" ${activePage === 'contact' ? 'style="box-shadow: 0 0 0 3px rgba(255,255,255,0.3)"' : ''}>Contact</a></li>
            </ul>
            <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Toggle menu">
                <span></span><span></span><span></span>
            </button>
        </nav>
    </header>`;
}

// ========== Shared Footer HTML ==========
function getFooterHTML() {
    return `
    <footer>
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <img src="logo.png" alt="Expert Eprocure GeM">
                    <p>Your trusted partner for Government e-Marketplace procurement solutions. Expert GeM registration, bidding support, and consultancy.</p>
                    <div class="footer-social">
                        <a href="https://wa.me/919523442474" target="_blank" rel="noopener" title="WhatsApp">💬</a>
                        <a href="https://www.instagram.com/experteprocuregem" target="_blank" rel="noopener" title="Instagram">📷</a>
                        <a href="https://www.facebook.com/profile.php?id=906165535922847" target="_blank" rel="noopener" title="Facebook">📘</a>
                        <a href="https://www.linkedin.com/in/expert-eprocure-gem-a49061393/" target="_blank" rel="noopener" title="LinkedIn">🔗</a>
                        <a href="https://whatsapp.com/channel/0029VbC7d2kGZNCvXhx29H0K" target="_blank" rel="noopener" title="Updates">📢</a>
                    </div>
                </div>
                <div class="footer-col">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><a href="index.html">Home</a></li>
                        <li><a href="about.html">About Us</a></li>
                        <li><a href="services.html">Services</a></li>
                        <li><a href="blog.html">Blog</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Services</h4>
                    <ul>
                        <li><a href="services.html">GeM Registration</a></li>
                        <li><a href="services.html">Bid Management</a></li>
                        <li><a href="services.html">Cataloging</a></li>
                        <li><a href="services.html">Compliance</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Contact</h4>
                    <ul>
                        <li><a href="tel:+919523442474">+91 95234 42474</a></li>
                        <li><a href="mailto:experteprocuregem@zohomail.in">Email Us</a></li>
                        <li><a href="tickets.html">Consultancy Queries</a></li>
                        <li><a href="contact.html">Get in Touch</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>© 2026 Expert Eprocure GeM. All rights reserved. | Your Trusted GeM Procurement Partner</p>
            </div>
        </div>
    </footer>`;
}

// ========== Shared Chatbot HTML ==========
function getChatbotHTML() {
    return `
    <button class="chatbot-fab" id="chatbotFab" aria-label="Chat with AI">🤖</button>
    <div class="chatbot-panel" id="chatbotPanel">
        <div class="chatbot-header">
            <div class="chatbot-header-info">
                <div class="avatar">🤖</div>
                <div>
                    <h4>GeM AI Assistant</h4>
                    <p>Powered by Gemini AI</p>
                </div>
            </div>
            <button class="chatbot-close" id="chatbotClose">✕</button>
        </div>
        <div class="chatbot-messages" id="chatMessages">
            <div class="chat-msg bot">👋 Hello! I'm your GeM AI Assistant. Ask me anything about Government e-Marketplace registration, bidding, or procurement!</div>
        </div>
        <div class="chatbot-suggestions">
            <button>How to register on GeM?</button>
            <button>Documents needed?</button>
            <button>How does bidding work?</button>
        </div>
        <div class="chatbot-input">
            <input type="text" id="chatInput" placeholder="Ask about GeM..." autocomplete="off">
            <button id="chatSend">➤</button>
        </div>
    </div>`;
}
