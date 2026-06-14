-- ========================
-- Migration 004: Add sender_name to chat_messages
-- ========================
-- The frontend inserts sender_name to identify anonymous users (and avoid missing profiles).
-- This column must exist for the chat insert query to succeed.

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS sender_name TEXT;
