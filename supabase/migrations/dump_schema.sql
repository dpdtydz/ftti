-- ================================================
-- Schema Dump Script
-- ================================================
-- Run this to see what tables and columns actually exist.

SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM 
    information_schema.tables t
JOIN 
    information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE 
    t.table_schema = 'public'
ORDER BY 
    t.table_name, c.ordinal_position;
