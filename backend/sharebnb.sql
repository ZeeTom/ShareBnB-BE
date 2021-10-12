\echo 'Delete and recreate sharebnb_lz db?'
\prompt 'Return for yes or control-C to cancel > ' foo

DROP DATABASE sharebnb_lz;
CREATE DATABASE sharebnb_lz;
\connect sharebnb_lz

\i sharebnb-schema.sql
\i sharebnb-seed.sql

\echo 'Delete and recreate sharebnb_lz_test db?'
\prompt 'Return for yes or control-C to cancel > ' foo

DROP DATABASE sharebnb_lz_test;
CREATE DATABASE sharebnb_lz_test;
\connect sharebnb_lz_test

\i sharebnb-schema.sql