-- Migration: Fix missing book copy QR sequence and default value
-- Problem: book_copies.qr_string is NOT NULL but lacks a default, causing creation failures.
-- Fix: Restore the sequence and set the default column value.

-- 1. Create the sequence starting from the next available number (Max was 242)
CREATE SEQUENCE IF NOT EXISTS public.book_copy_qr_seq START WITH 243;

-- 2. Set the default for qr_string to use the sequence
ALTER TABLE public.book_copies 
ALTER COLUMN qr_string SET DEFAULT 'QR-' || nextval('public.book_copy_qr_seq');

-- 3. Ensure sequence is owned by the column so it gets dropped if the column is dropped
ALTER SEQUENCE public.book_copy_qr_seq OWNED BY public.book_copies.qr_string;
