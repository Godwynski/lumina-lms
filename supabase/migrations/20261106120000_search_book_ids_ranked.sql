-- Ranked book search for Inventory and Student Catalog ("Best match").
-- Returns matching book ids in relevance order, plus the total match count,
-- so the app can page through results and still load books with its usual select.
--
-- Ranking tiers (lower is better):
--   0 exact ISBN (dashes ignored)   1 exact title        2 title starts with query
--   3 title has all words / contains query                4 author match
--   5 anything else that matched (e.g. partial ISBN)
-- Ties: full-text rank (title weighted highest), then title A-Z.
--
-- SECURITY INVOKER: row-level security on books still applies to the caller.
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.search_book_ids(
  p_query text,
  p_status text DEFAULT 'ACTIVE',
  p_category_ids uuid[] DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_available_only boolean DEFAULT false,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
 RETURNS TABLE(id uuid, total_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT
      lower(btrim(coalesce(p_query, ''))) AS raw,
      -- LIKE-safe version of the query (escape \ % _)
      replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') AS esc,
      regexp_replace(lower(btrim(coalesce(p_query, ''))), '[^0-9a-z]', '', 'g') AS isbn_key
  ),
  words AS (
    SELECT w
    FROM q, regexp_split_to_table(regexp_replace(q.raw, '[^[:alnum:][:space:]]', ' ', 'g'), '\s+') AS w
    WHERE w <> ''
  ),
  tsq AS (
    -- Prefix match on every word ("lord of" -> lord:* & of:*). Only for 3+ characters.
    SELECT CASE
             WHEN length((SELECT raw FROM q)) >= 3 AND EXISTS (SELECT 1 FROM words)
             THEN to_tsquery('english', (SELECT string_agg(w || ':*', ' & ') FROM words))
           END AS v
  ),
  matched AS (
    SELECT
      b.id,
      b.title,
      CASE
        WHEN q.isbn_key <> '' AND regexp_replace(lower(coalesce(b.isbn, '')), '[^0-9a-z]', '', 'g') = q.isbn_key THEN 0
        WHEN lower(b.title) = q.raw THEN 1
        WHEN lower(b.title) LIKE q.esc || '%' THEN 2
        WHEN (tsq.v IS NOT NULL AND to_tsvector('english', coalesce(b.title, '')) @@ tsq.v)
          OR lower(b.title) LIKE '%' || q.esc || '%' THEN 3
        WHEN (tsq.v IS NOT NULL AND to_tsvector('english', coalesce(b.author, '')) @@ tsq.v)
          OR lower(coalesce(b.author, '')) LIKE '%' || q.esc || '%' THEN 4
        ELSE 5
      END AS tier,
      CASE WHEN tsq.v IS NOT NULL THEN ts_rank_cd(b.search_vector, tsq.v) ELSE 0 END AS score
    FROM public.books b, q, tsq
    WHERE q.raw <> ''
      AND (
        CASE
          -- 1-2 characters: titles only, so "c" isn't flooded by author/ISBN noise
          WHEN length(q.raw) < 3 THEN lower(b.title) LIKE '%' || q.esc || '%'
          ELSE (tsq.v IS NOT NULL AND b.search_vector @@ tsq.v)
            OR lower(b.title) LIKE '%' || q.esc || '%'
            OR lower(coalesce(b.author, '')) LIKE '%' || q.esc || '%'
            OR lower(coalesce(b.isbn, '')) LIKE '%' || q.esc || '%'
        END
      )
      AND (p_status = 'ALL'
           OR (p_status = 'ARCHIVED' AND b.is_active = false)
           OR (coalesce(p_status, 'ACTIVE') = 'ACTIVE' AND b.is_active = true))
      AND (p_category_ids IS NULL OR cardinality(p_category_ids) = 0 OR b.category_id = ANY (p_category_ids))
      AND (p_section IS NULL OR p_section = '' OR b.section = p_section)
      AND (NOT coalesce(p_available_only, false) OR b.available_copies > 0)
  )
  SELECT m.id, count(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.tier, m.score DESC, lower(m.title), m.id
  OFFSET greatest(coalesce(p_offset, 0), 0)
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

REVOKE EXECUTE ON FUNCTION public.search_book_ids(text, text, uuid[], text, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_book_ids(text, text, uuid[], text, boolean, integer, integer) TO anon, authenticated, service_role;

COMMIT;
