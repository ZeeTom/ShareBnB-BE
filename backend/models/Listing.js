"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

const DEFAULT_IMAGE =
  "https://sharebnb-photos-grant.s3.amazonaws.com/sharebnb-photos/listing-picture1.jpg";

class Listing {
  /**
   * TODO: add docstring
   */

  static async create(
    { title, description, location, price, image },
    username
  ) {
    const result = await db.query(
      `INSERT INTO listings
          (title, description, location, price, username, image)
          VALUES
          ($1, $2, $3, $4, $5, $6)
          RETURNING id, title, description, location, price, username, image`,
      [title, description, location, price, username, image]
    );

    const listing = result.rows[0];
    return listing;
  }

  /** Create WHERE clause for filters, to be used by functions that query
   * with filters.
   *
   * searchFilters (all optional):
   * - minPrice
   * - maxPrice
   * - location (will find case-insensitive, partial matches)
   *
   * Returns {
   *  where: "WHERE price <= $1 AND location ILIKE $2",
   *  vals: [1000, '%new%']
   * }
   */

  static _filterWhereBuilder({ minPrice, maxPrice, location }) {
    let whereParts = [];
    let vals = [];

    if (minPrice !== undefined) {
      vals.push(minPrice);
      whereParts.push(`price >= $${vals.length}`);
    }

    if (maxPrice !== undefined) {
      vals.push(maxPrice);
      whereParts.push(`price <= $${vals.length}`);
    }

    if (location) {
      vals.push(`%${location}%`);
      whereParts.push(`location ILIKE $${vals.length}`);
    }

    const where =
      whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    return { where, vals };
  }

  /** Find all companies (optional filter on searchFilters).
   *
   * searchFilters (all optional):
   * - minPrice
   * - maxPrice
   * - location (will find case-insensitive, partial matches)
   *
   * Returns [{ id, title, description, location, price, username, image }, ...]
   * */

  static async findAll(searchFilters = {}) {
    const { minPrice, maxPrice, location } = searchFilters;

    if (minPrice > maxPrice) {
      throw new BadRequestError("Min price cannot be greater than max price");
    }

    const { where, vals } = this._filterWhereBuilder({
      minPrice,
      maxPrice,
      location,
    });

    const listingsRes = await db.query(
      `
      SELECT id,
             title,
             description,
             location,
             price,
             username,
             image
        FROM listings ${where}
        ORDER BY title
    `,
      vals
    );

    return listingsRes.rows;
  }

  /** Given a listing id, return data about listing.
   *
   * Returns { id, title, description, location, price, username, image }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const listingRes = await db.query(
      `SELECT id,
                    title,
                    description,
                    location,
                    price,
                    username,
                    image
             FROM listings
             WHERE id = $1`,
      [id]
    );

    const listing = listingRes.rows[0];

    if (!listing) throw new NotFoundError(`No listing: ${id}`);

    // const companiesRes = await db.query(
    //   `SELECT handle,
    //                 name,
    //                 description,
    //                 num_employees AS "numEmployees",
    //                 logo_url AS "logoUrl"
    //          FROM companies
    //          WHERE handle = $1`, [listing.companyHandle]);

    // delete listing.companyHandle;
    // listing.company = companiesRes.rows[0];

    return listing;
  }

  /** Update listing data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include: { title, description, location, price, image }
   *
   * Returns { id, title, description, location, price, username, image }
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(data, {});
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE listings 
                        SET ${setCols} 
                        WHERE id = ${idVarIdx} 
                        RETURNING id, 
                                  title, 
                                  description, 
                                  location,
                                  price,
                                  username,
                                  image`;
    const result = await db.query(querySql, [...values, id]);
    const listing = result.rows[0];

    if (!listing) throw new NotFoundError(`No listing: ${id}`);

    return listing;
  }

  /** Delete given listing from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(id) {
    const result = await db.query(
      `DELETE
             FROM listings
             WHERE id = $1
             RETURNING id`,
      [id]
    );
    const listing = result.rows[0];

    if (!listing) throw new NotFoundError(`No listing: ${id}`);
  }
}

module.exports = Listing;
