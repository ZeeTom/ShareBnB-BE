"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

class User {
  /** authenticate user with username, password.
   *
   * Returns {username, firstName, lastName, email}
   *
   * Throws Unauthorized is user not found found or wrong password.
   */

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
      `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email
           FROM users
           WHERE username = $1`,
      [username]
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid credentials");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email}
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register({ username, password, firstName, lastName, email }) {
    const duplicateCheck = await db.query(
      `SELECT username
         FROM users
         WHERE username = $1`,
      [username]
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
      `INSERT INTO users
         (username,
          password,
          first_name,
          last_name,
          email)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING username, first_name AS "firstName", last_name AS "lastName", email`,
      [username, hashedPassword, firstName, lastName, email]
    );

    const user = result.rows[0];

    return user;
  }

  static async findAll(searchTerm) {
    const { where, vals } = this._filterWhereBuilder(searchTerm);

    const result = await db.query(
      `SELECT username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email
           FROM users
           ${where}
           ORDER BY username`,
      vals
    );

    return result.rows;
  }

  /** Create WHERE clause for filters, to be used by functions that query with filter.
   *
   * searchFilters (optional):
   * - username (will find case-insensitive, partial matches)
   *
   * Returns {
   *  where: "WHERE username ILIKE $1",
   *  vals: ['%grant%']
   * }
   */

  static _filterWhereBuilder(username) {
    let whereParts = [];
    let vals = [];

    if (username) {
      vals.push(`%${username}%`);
      whereParts.push(`username ILIKE $${vals.length}`);
    }

    const where =
      whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    return { where, vals };
  }

  /** Given a username, return data about user.
   *
   * Returns { username, firstName, lastName, email, listings, bookings }
   *   where listings is [{ id, title, description, location, price }, ...]
   *   where bookings is [listing_id, ...]
   * Throws NotFoundError if user not found.
   **/

  static async get(username) {
    const userRes = await db.query(
      `SELECT username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email
           FROM users
           WHERE username = $1`,
      [username]
    );

    const user = userRes.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    const userListingsRes = await db.query(
      `SELECT id,
                  title,
                  description,
                  location,
                  price
           FROM listings
           WHERE username = $1`,
      [username]
    );

    user.listings = userListingsRes.rows;

    const userBookingsRes = await db.query(
      `SELECT listing_id as "listingId"
           FROM bookings
           WHERE username = $1
           ORDER BY listing_id`,
      [username]
    );

    user.bookings = userBookingsRes.rows.map((r) => r.listingId);

    return user;
  }

  /** Update user data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { firstName, lastName, password, email }
   *
   * Returns { username, firstName, lastName, email }
   *
   * Throws NotFoundError if not found.
   *
   * WARNING: this function can set a new password or make a user an admin.
   * Callers of this function must be certain they have validated inputs to this
   * or a serious security risks are opened.
   */

  static async update(username, data) {
    // if (data.password) {
    //   data.password = await bcrypt.hash(data.password, BCRYPT_WORK_FACTOR);
    // }

    await this.authenticate(username, data.password);
    delete data.password;

    const { setCols, values } = sqlForPartialUpdate(data, {
      firstName: "first_name",
      lastName: "last_name",
    });
    const usernameVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE users 
                      SET ${setCols} 
                      WHERE username = ${usernameVarIdx} 
                      RETURNING username,
                                first_name AS "firstName",
                                last_name AS "lastName",
                                email`;
    const result = await db.query(querySql, [...values, username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    return user;
  }

  /** Delete given user from database; returns undefined. */

  static async remove(username, password) {
    await this.authenticate(username, password);

    let result = await db.query(
      `DELETE
           FROM users
           WHERE username = $1
           RETURNING username`,
      [username]
    );
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);
  }

  /** Book a listing: update db, returns listing title.
   *
   * - username: username booking listing
   * - listingId: listing id
   **/

  static async bookListing(username, listingId) {
    const preCheck = await db.query(
      `SELECT id,
              title,
              username
           FROM listings
           WHERE id = $1`,
      [listingId]
    );
    const listing = preCheck.rows[0];

    if (!listing) throw new NotFoundError(`No listing: ${listingId}`);

    const preCheck2 = await db.query(
      `SELECT username
           FROM users
           WHERE username = $1`,
      [username]
    );
    const user = preCheck2.rows[0];

    if (!user) throw new NotFoundError(`No username: ${username}`);

    if (listing.username === user.username) {
      throw new BadRequestError(`Can't book own listing`);
    }

    const preCheck3 = await db.query(
      `SELECT listing_id
           FROM bookings
           WHERE username = $1 AND listing_id = $2`,
      [username, listingId]
    );
    const booking = preCheck3.rows;

    if (booking.length)
      throw new BadRequestError(`Can't book the same listing twice`);

    await db.query(
      `INSERT INTO bookings (username, listing_id)
           VALUES ($1, $2)`,
      [username, listingId]
    );

    return listing.title;
  }

  /** Unbook a listing: update db, returns listing title.
   *
   * - username: username unbooking a listing
   * - listingId: listing id
   **/

  static async unBookListing(username, listingId) {
    const preCheck = await db.query(
      `SELECT id,
                  title
           FROM listings
           WHERE id = $1`,
      [listingId]
    );
    const listing = preCheck.rows[0];

    if (!listing) throw new NotFoundError(`No listing: ${listingId}`);

    const preCheck2 = await db.query(
      `SELECT username
           FROM users
           WHERE username = $1`,
      [username]
    );
    const user = preCheck2.rows[0];

    if (!user) throw new NotFoundError(`No username: ${username}`);

    const preCheck3 = await db.query(
      `SELECT listing_id
           FROM bookings
           WHERE username = $1 AND listing_id = $2`,
      [username, listingId]
    );
    const booking = preCheck3.rows;

    if (!booking.length)
      throw new BadRequestError(`You have not booked this listing`);

    await db.query(
      `DELETE FROM bookings
           WHERE username = $1 AND listing_id = $2`,
      [username, listingId]
    );

    return listing.title;
  }

  /**
   * Gets array of listings that user has booked
   *
   * [{ id, title, description, price, location, image }, ...]
   *
   */

  static async getBookings(username) {
    const preCheck1 = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
      [username]
    );
    const user = preCheck1.rows[0];

    if (!user) throw new NotFoundError(`No username: ${username}`);

    const listings = await db.query(
      `SELECT 
          l.id,
          l.title,
          l.description,
          l.price,
          l.location,
          l.image
      FROM users AS u 
        JOIN bookings AS b ON b.username = u.username
        JOIN listings AS l ON b.listing_id = l.id
      WHERE u.username = $1`,
      [username]
    );

    return listings.rows;
  }

  /**
   * Given a username, toUser and text, sends a message from
   * username to toUser
   *
   * returns message: { message:{ text, sentTime } }
   *
   */

  static async sendMessage(username, otherUser, text) {
    if (username === otherUser) {
      throw new BadRequestError("You cannot message yourself.");
    }

    const preCheck1 = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
      [username]
    );
    const user1 = preCheck1.rows[0];

    if (!user1) throw new NotFoundError(`No username: ${username}`);

    const preCheck2 = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
      [otherUser]
    );
    const user2 = preCheck2.rows[0];

    if (!user2) throw new NotFoundError(`No username: ${otherUser}`);

    const response = await db.query(
      `INSERT INTO messages (from_user, to_user, text)
           VALUES ($1, $2, $3)
           RETURNING text, sent_time AS "sentTime"`,
      [username, otherUser, text]
    );

    const message = response.rows[0];

    return message;
  }

  /**
   * Given a username and otherUser, fetches an array of messages
   * between the two users
   *
   * returns array of messages: [{ message:{ text, sentTime } }, ...]
   *
   */

  static async getMessages(username, otherUser) {
    if (username === otherUser) {
      throw new BadRequestError("You cannot message yourself.");
    }

    const preCheck1 = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
      [username]
    );
    const user1 = preCheck1.rows[0];

    if (!user1) throw new NotFoundError(`No username: ${username}`);

    const preCheck2 = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
      [otherUser]
    );
    const user2 = preCheck2.rows[0];

    if (!user2) throw new NotFoundError(`No username: ${otherUser}`);

    const messageResp = await db.query(
      `SELECT text,
              sent_time AS "sentTime",
              to_user AS "toUser",
              from_user AS "fromUser"
          FROM messages
          WHERE to_user = $1 AND from_user = $2
            OR from_user = $1 AND to_user = $2
          ORDER BY sent_time`,
      [username, otherUser]
    );

    const messages = messageResp.rows;

    return messages;
  }

  static async getInboxUsers(username) {
    // if (username === otherUser) {
    //   throw new BadRequestError("You cannot message yourself.");
    // }

    const preCheck1 = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
      [username]
    );
    const user1 = preCheck1.rows[0];

    if (!user1) throw new NotFoundError(`No username: ${username}`);

    const resp = await db.query(
      `SELECT
      MAX(sent_time) AS "sentTime",
       to_user AS "toUser",
       from_user AS "fromUser"
        FROM messages
        WHERE to_user = $1 
        OR from_user = $1
        GROUP BY to_user, from_user
        ORDER BY MAX(sent_time) DESC;
          `,
      [username]
    );

    const messagesMetaData = resp.rows;
    let inboxUsers = messagesMetaData.map((m) =>
      m.fromUser === username ? m.toUser : m.fromUser
    );

    inboxUsers = Array.from(new Set(inboxUsers));

    return inboxUsers;
  }
}

module.exports = User;
