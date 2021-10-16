INSERT INTO users (username, password, first_name, last_name, email)
VALUES ('lawnknee',
        '$2b$12$AZH7virni5jlTTiGgEg4zu3lSvAw68qVEfSIOjJ3RqtbJbdW/Oi5q',
        'Loni',
        'Kuang',
        'loni@loni.com'),
       ('zeetom',
        '$2b$12$AZH7virni5jlTTiGgEg4zu3lSvAw68qVEfSIOjJ3RqtbJbdW/Oi5q',
        'Zach',
        'Thomas',
        'zach@zach.com');

INSERT INTO listings (title,
                      description,
                      location,
                      price,
                      username)
VALUES ('Fairytale Getaway', 'The house of your dreams', 'New Mexico', 1000, 'u1'),
       ('The Swamp', 'Beware the ogre', 'Far Far Away', 150, 'u2'),
       ('Castle On The Hill', 'Like out of the song', 'Ireland', 750, 'u2');

INSERT INTO messages (text,
                      to_user,
                      from_user)
VALUES ('Hello Zach', 'u2', 'u1'),
       ('Hello Grant', 'u1', 'u2');
