\echo 'Delete and recreate sharebnb db?'
\prompt 'Return for yes or control-C to cancel > ' foo

DROP DATABASE sharebnb;
CREATE DATABASE sharebnb;
\connect sharebnb

\i sharebnb-schema.sql
\i sharebnb-seed.sql

\echo 'Delete and recreate sharebnb_test db?'
\prompt 'Return for yes or control-C to cancel > ' foo

DROP DATABASE sharebnb_test;
CREATE DATABASE sharebnb_test;
\connect sharebnb_test

\i sharebnb-schema.sql