"use strict";

/** Routes for users. */

const jsonschema = require("jsonschema");

const express = require("express");
const { ensureLoggedIn, ensureCorrectUser } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const User = require("../models/user");
const userSearchSchema = require("../schemas/userSearch.json");
const userUpdateSchema = require("../schemas/userUpdate.json");
const messageNewSchema = require("../schemas/messageNew.json");

const router = express.Router();

router.get("/", ensureLoggedIn, async function (req, res, next) {
  const validator = jsonschema.validate(req.query, userSearchSchema);
  if (!validator.valid) {
    const errs = validator.errors.map((e) => e.stack);
    throw new BadRequestError(errs);
  }

  const searchTerm = req.query.username;
  try {
    const users = await User.findAll(searchTerm);
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
});

/** GET /[username] => { user }
 *
 * Returns { username, firstName, lastName, email, listings }
 *   where listings is [{ id, title, description, location, price }, ...]
 *
 * Authorization required: logged in
 **/

router.get("/:username", ensureLoggedIn, async function (req, res, next) {
  try {
    const user = await User.get(req.params.username);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /[username] { user } => { user }
 *
 * Data can include:
 *   { firstName, lastName, password (required for verification), email }
 *
 * Returns { username, firstName, lastName, email }
 *
 * Authorization required: correct user
 **/

router.patch("/:username", ensureCorrectUser, async function (req, res, next) {
  const validator = jsonschema.validate(req.body, userUpdateSchema);
  if (!validator.valid) {
    const errs = validator.errors.map((e) => e.stack);
    throw new BadRequestError(errs);
  }

  try {
    const user = await User.update(req.params.username, req.body);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[username]  =>  { deleted: username }
 *
 * Authorization required: correct user
 **/

router.delete("/:username", ensureCorrectUser, async function (req, res, next) {
  try {
    await User.remove(req.params.username, req.body.password);
    return res.json({ deleted: req.params.username });
  } catch (err) {
    return next(err);
  }
});

/** GET /[username]/bookings
 *
 * Returns array of bookings: [{ id, title, description, price, location, image }, ...]
 *
 * Authorization required: correct user
 * */

router.get(
  "/:username/bookings",
  ensureCorrectUser,
  async function (req, res, next) {
    try {
      const username = req.params.username;
      const bookings = await User.getBookings(username);
      return res.json({ bookings });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /[username]/bookings/[id]
 *
 * Returns {"booked": title}
 *
 * Authorization required: correct user
 * */

router.post(
  "/:username/bookings/:id",
  ensureCorrectUser,
  async function (req, res, next) {
    try {
      const listingId = +req.params.id;
      const title = await User.bookListing(req.params.username, listingId);
      return res.json({ booked: title });
    } catch (err) {
      return next(err);
    }
  }
);

/** DELETE /[username]/bookings/[id]
 *
 * Returns {"canceled": title}
 *
 * Authorization required: correct user
 * */

router.delete(
  "/:username/bookings/:id",
  ensureCorrectUser,
  async function (req, res, next) {
    try {
      const listingId = +req.params.id;
      const title = await User.unBookListing(req.params.username, listingId);
      return res.json({ canceled: title });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /[username]/messages/[otherUser]
 *
 * Returns { { message:{ text, sentTime } }
 *
 * Authorization required: correct user
 * */

router.post("/:username/messages/:otherUser", async function (req, res, next) {
  const validator = jsonschema.validate(req.body, messageNewSchema);
  if (!validator.valid) {
    const errs = validator.errors.map((e) => e.stack);
    throw new BadRequestError(errs);
  }

  const message = await User.sendMessage(
    req.params.username,
    req.params.otherUser,
    req.body.text
  );
  return res.status(201).json({ message });
});

router.get("/:username/messages", async function (req, res, next) {
  const users = await User.getInboxUsers(req.params.username);
  return res.json({ users });
});

/** GET /[username]/messages/[otherUser]
 *
 * Returns [{ { message:{ text, sentTime } }, ...]
 *
 * Authorization required: correct user
 * */

router.get("/:username/messages/:otherUser", async function (req, res, next) {
  const messages = await User.getMessages(
    req.params.username,
    req.params.otherUser
  );
  return res.json({ messages });
});

module.exports = router;
