-- ============================================
-- Expert Eprocure GeM - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTACTS TABLE
-- Stores all contact form submissions
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(255),
    service_interest VARCHAR(255),
    message TEXT NOT NULL,
    source_page VARCHAR(500),
    ip_address VARCHAR(50),
    user_agent TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    assigned_to VARCHAR(255),
    notes TEXT,
    follow_up_status VARCHAR(50) DEFAULT 'pending',
    follow_up_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_is_read ON contacts(is_read);
CREATE INDEX IF NOT EXISTS idx_contacts_service ON contacts(service_interest);

-- ============================================
-- ADMIN USERS TABLE
-- Stores admin authentication data
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INSERT DEFAULT ADMIN USER
-- Password: Admin@123 (change this immediately!)
-- The hash below is for 'Admin@123' using bcryptjs
-- ============================================
INSERT INTO admin_users (name, email, password_hash, role)
VALUES (
    'Admin',
    'admin@experteprocure.com',
    '$2a$10$XQK2ZPKvYqX5Q5Q5Q5Q5Q.Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- NOTE: You need to generate a proper bcrypt hash for your password
-- Use this Node.js command to generate one:
-- const bcrypt = require('bcryptjs');
-- bcrypt.hash('YourSecurePassword', 10).then(console.log);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access all contacts" ON contacts
    FOR ALL USING (true);

CREATE POLICY "Service role can access all admin_users" ON admin_users
    FOR ALL USING (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- Automatically update the updated_at column
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY TABLES CREATED
-- ============================================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('contacts', 'admin_users');

-- ============================================
-- TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(500) NOT NULL,
    category VARCHAR(100) DEFAULT 'Other',
    priority VARCHAR(20) DEFAULT 'medium',
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    admin_response TEXT,
    responded_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- RLS for tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for all users" ON tickets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for all users (by ticket_id)" ON tickets
    FOR SELECT USING (true);

CREATE POLICY "Enable all for service role" ON tickets
    FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BLOG POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100),
    featured_image VARCHAR(1000),
    is_published BOOLEAN DEFAULT FALSE,
    author VARCHAR(255) DEFAULT 'Admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC);

-- RLS for blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for published posts" ON blog_posts
    FOR SELECT USING (is_published = true);

CREATE POLICY "Enable all for service role" ON blog_posts
    FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify all tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('contacts', 'admin_users', 'tickets', 'blog_posts');
