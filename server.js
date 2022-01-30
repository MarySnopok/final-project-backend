import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import queryOverpass from "@derhuerst/query-overpass";

// const queryOverpass = require('@derhuerst/query-overpass')

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/authAPI";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
});

const User = mongoose.model("User", UserSchema);

// const ThoughtSchema = new mongoose.Schema({
//   message: {
//     type: String,
//     required: true,
//   },
// });

// const Thought = mongoose.model("Thought", ThoughtSchema);

// Defines the port the app will run on. Defaults to 8080, but can be
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
// v1 - Allow all domains
app.use(cors());

app.use(express.json());

const authenticateUser = async (req, res, next) => {
  const accessToken = req.header("Authorization");

  try {
    const user = await User.findOne({ accessToken });
    if (user) {
      req.user = user;
      next();
    } else {
      res.status(401).json({ response: "Please, log in", success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({ response: error, success: false });
  }
};

// Authentication - 401 (Unauthorized) But should be unauthenticated
// Authorization - 403 (Forbidden) But should be unauthorized

// Start defining your routes here

app.get("/profile", authenticateUser);
app.get("/profile", async (req, res) => {
  const user = req.user;

  res.status(200).json({ response: user, success: true });
});

// app.post("/thoughts", async (req, res) => {
//   const { message } = req.body;

//   try {
//     const newThought = await new Thought({ message }).save();
//     res.status(201).json({ response: newThought, success: true });
//   } catch (error) {
//     res.status(400).json({ response: error, success: false });
//   }
// });

/*
example query
  queryOverpass(`
[out:json][timeout:25];
node(3378340880);
out body;
`)
*/

// vasterhaninge latitude 59.1221593
// ~~~ // ~~~~~~ long     18.1085969

app.get("/tracks", async (req, res) => {
  const radius = Math.min(req.query.radius ?? 5_000, 10_000); // 10 km radius maximum
  const lat = req.query.lat ?? 59.122;
  const long = req.query.long ?? 18.108;
  queryOverpass(`
    [timeout:900][out:json];
    (
    rel
      [type=route]
      [route=hiking]
      (around:${radius}.0,${lat.toFixed(2)},${long.toFixed(2)});
      );
    out center tags geom body;
    `)
    .then((data) => {
      res.status(200).json({
        response: {
          data,
        },
        status: "success",
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({
        response: {
          error: err,
          status: "error",
        },
      });
    });
});

app.post("/signup", async (req, res) => {
  const { username, password, email } = req.body;

  try {
    const salt = bcrypt.genSaltSync();

    if (password.length < 5) {
      throw "Password must be at least 5 characters long";
    }

    const newUser = await new User({
      username,
      email,
      password: bcrypt.hashSync(password, salt),
    }).save();

    res.status(201).json({
      response: {
        userId: newUser._id,
        username: newUser.username,
        accessToken: newUser.accessToken,
        email: newUser.email,
      },
      success: true,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ response: error, success: false });
  }
});

app.post("/signin", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(200).json({
        response: {
          userId: user._id,
          username: user.username,
          accessToken: user.accessToken,
        },
        success: true,
      });
    } else {
      res.status(404).json({
        response: "Username or password doesn't match",
        success: false,
      });
    }
  } catch (error) {
    res.status(400).json({ response: error, success: false });
  }
});

// Start the server
app.listen(port, () => {
  // eslint-disable-next-line
  console.log(`Server running on http://localhost:${port}`);
});

// triggering deploy
